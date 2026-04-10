"""Gateway 설정을 TOML 파일에서 DB로 마이그레이션

기존 matterbridge.toml 파일의 Gateway 설정을 PostgreSQL로 이전
"""

import logging
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.database import SessionLocal, init_db  # noqa: E402
from app.models import Gateway, GatewayChannel  # noqa: E402
from app.services.config_manager import ConfigManager  # noqa: E402

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def migrate_gateways():
    """TOML 파일의 Gateway를 DB로 마이그레이션"""

    # Initialize DB tables
    logger.info("Initializing database tables...")
    init_db()

    # Read config from TOML
    config_manager = ConfigManager()
    try:
        config = config_manager.read_config()
    except Exception as e:
        logger.error(f"Failed to read config: {e}")
        logger.warning("No existing config to migrate")
        return

    gateway_configs = config.get("gateway", [])

    if not gateway_configs:
        logger.warning("No gateways found in config file")
        return

    # Migrate to DB
    db = SessionLocal()
    try:
        migrated_count = 0

        for gw_config in gateway_configs:
            name = gw_config.get("name")
            if not name:
                logger.warning("Skipping gateway without name")
                continue

            # Check if already exists
            existing = db.query(Gateway).filter(Gateway.name == name).first()
            if existing:
                logger.warning(f"Gateway '{name}' already exists, skipping")
                continue

            # Create Gateway
            gateway = Gateway(name=name, enabled=gw_config.get("enable", True))

            # Add channels
            for inout in gw_config.get("inout", []):
                account = inout.get("account")
                channel = inout.get("channel")

                if not account or not channel:
                    logger.warning(f"Skipping invalid channel in gateway '{name}'")
                    continue

                gateway_channel = GatewayChannel(account=account, channel=channel)
                gateway.channels.append(gateway_channel)

            if len(gateway.channels) < 2:
                logger.warning(f"Gateway '{name}' has less than 2 channels, skipping")
                continue

            db.add(gateway)
            migrated_count += 1
            logger.info(
                f"Migrated gateway '{name}' with {len(gateway.channels)} channels"
            )

        db.commit()
        logger.info(f"✓ Successfully migrated {migrated_count} gateways to database")

    except Exception as e:
        db.rollback()
        logger.error(f"Migration failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    logger.info("Starting Gateway migration from TOML to DB...")
    migrate_gateways()
    logger.info("Migration complete!")
