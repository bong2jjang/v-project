"""
AttachmentHandler 단위 테스트

_extract_filename 우선순위 체인과 download_file 동작을 검증합니다.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.utils.attachment_handler import AttachmentHandler


class TestExtractFilename:
    """_extract_filename 메서드 테스트 — 파일명 추출 우선순위 검증"""

    def _make_response(
        self,
        content_disposition: str = "",
        content_type: str = "application/octet-stream",
    ) -> MagicMock:
        """Mock aiohttp.ClientResponse 생성"""
        response = MagicMock()
        headers = {}
        if content_disposition:
            headers["Content-Disposition"] = content_disposition
        if content_type:
            headers["Content-Type"] = content_type
        response.headers = headers
        return response

    # ── 1순위: Content-Disposition ────────────────────────────────────

    def test_content_disposition_quoted(self):
        """Content-Disposition: attachment; filename="report.pdf" """
        resp = self._make_response(
            content_disposition='attachment; filename="report.pdf"'
        )
        result = AttachmentHandler._extract_filename(resp, "https://example.com/$value")
        assert result == "report.pdf"

    def test_content_disposition_unquoted(self):
        """Content-Disposition: attachment; filename=image.png"""
        resp = self._make_response(content_disposition="attachment; filename=image.png")
        result = AttachmentHandler._extract_filename(resp, "https://example.com/$value")
        assert result == "image.png"

    def test_content_disposition_utf8(self):
        """Content-Disposition: attachment; filename*=UTF-8''한글파일.xlsx"""
        resp = self._make_response(
            content_disposition="attachment; filename*=UTF-8''한글파일.xlsx"
        )
        result = AttachmentHandler._extract_filename(resp, "https://example.com/$value")
        assert result == "한글파일.xlsx"

    def test_content_disposition_dollar_value_ignored(self):
        """Content-Disposition filename=$value 는 무시하고 다음 우선순위로"""
        resp = self._make_response(
            content_disposition='attachment; filename="$value"',
            content_type="image/png",
        )
        # URL도 $value → fallback 없음 → Content-Type
        result = AttachmentHandler._extract_filename(
            resp, "https://graph.microsoft.com/hostedContents/abc/$value"
        )
        assert result == "image.png"

    # ── 2순위: URL 경로 ──────────────────────────────────────────────

    def test_url_with_valid_filename(self):
        """URL 경로에 유효한 파일명이 있는 경우"""
        resp = self._make_response()
        result = AttachmentHandler._extract_filename(
            resp, "https://files.slack.com/files-pri/T0001/download/screenshot.png"
        )
        assert result == "screenshot.png"

    def test_url_with_query_params(self):
        """URL에 쿼리 파라미터가 있어도 파일명 추출"""
        resp = self._make_response()
        result = AttachmentHandler._extract_filename(
            resp, "https://example.com/files/doc.pdf?token=abc123"
        )
        assert result == "doc.pdf"

    def test_url_dollar_value_skipped(self):
        """URL 마지막 세그먼트가 $value이면 무시"""
        resp = self._make_response(content_type="image/jpeg")
        result = AttachmentHandler._extract_filename(
            resp,
            "https://graph.microsoft.com/v1.0/chats/abc/messages/123/hostedContents/456/$value",
        )
        # $value → fallback 없음 → Content-Type
        assert result == "image.jpg"

    def test_url_no_extension_skipped(self):
        """URL 마지막 세그먼트에 확장자가 없으면 무시"""
        resp = self._make_response(content_type="image/gif")
        result = AttachmentHandler._extract_filename(
            resp, "https://example.com/api/files/abc123"
        )
        # abc123에 .이 없으므로 → fallback 없음 → Content-Type
        assert result == "image.gif"

    # ── 3순위: fallback_filename ─────────────────────────────────────

    def test_fallback_filename_used(self):
        """URL과 Content-Disposition 모두 실패 시 fallback_filename 사용"""
        resp = self._make_response()
        result = AttachmentHandler._extract_filename(
            resp,
            "https://graph.microsoft.com/hostedContents/abc/$value",
            fallback_filename="original_name.png",
        )
        assert result == "original_name.png"

    def test_fallback_not_used_when_url_valid(self):
        """URL이 유효하면 fallback은 사용하지 않음"""
        resp = self._make_response()
        result = AttachmentHandler._extract_filename(
            resp,
            "https://example.com/files/real.pdf",
            fallback_filename="fallback.pdf",
        )
        assert result == "real.pdf"

    def test_fallback_not_used_when_content_disposition_valid(self):
        """Content-Disposition이 유효하면 fallback은 사용하지 않음"""
        resp = self._make_response(
            content_disposition='attachment; filename="header.docx"'
        )
        result = AttachmentHandler._extract_filename(
            resp,
            "https://example.com/$value",
            fallback_filename="fallback.docx",
        )
        assert result == "header.docx"

    # ── 4순위: Content-Type 기반 기본 이름 ────────────────────────────

    def test_content_type_png(self):
        resp = self._make_response(content_type="image/png")
        result = AttachmentHandler._extract_filename(resp, "https://example.com/$value")
        assert result == "image.png"

    def test_content_type_jpeg(self):
        resp = self._make_response(content_type="image/jpeg; charset=utf-8")
        result = AttachmentHandler._extract_filename(resp, "https://example.com/$value")
        assert result == "image.jpg"

    def test_content_type_pdf(self):
        resp = self._make_response(content_type="application/pdf")
        result = AttachmentHandler._extract_filename(resp, "https://example.com/$value")
        assert result == "file.pdf"

    def test_content_type_unknown_fallback(self):
        """매핑되지 않은 Content-Type → attachment.bin"""
        resp = self._make_response(content_type="application/x-custom")
        result = AttachmentHandler._extract_filename(resp, "https://example.com/$value")
        assert result == "attachment.bin"


class TestDownloadFile:
    """download_file 메서드 테스트"""

    @pytest.mark.asyncio
    async def test_download_success(self, tmp_path):
        """정상 다운로드 시 로컬 경로 반환"""
        handler = AttachmentHandler()
        handler.temp_dir = tmp_path

        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.headers = {
            "Content-Type": "image/png",
            "Content-Length": "100",
        }

        # iter_chunked 시뮬레이션
        async def fake_iter_chunked(size):
            yield b"fake image data"

        mock_response.content.iter_chunked = fake_iter_chunked
        mock_response.__aenter__ = AsyncMock(return_value=mock_response)
        mock_response.__aexit__ = AsyncMock(return_value=False)

        mock_session = AsyncMock()
        mock_session.get = MagicMock(return_value=mock_response)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        with patch(
            "app.utils.attachment_handler.aiohttp.ClientSession",
            return_value=mock_session,
        ):
            result = await handler.download_file(
                url="https://example.com/files/test.png",
                fallback_filename="backup.png",
            )

        assert result is not None
        assert "test.png" in result

    @pytest.mark.asyncio
    async def test_download_http_error_returns_none(self, tmp_path):
        """HTTP 에러 시 None 반환"""
        handler = AttachmentHandler()
        handler.temp_dir = tmp_path

        mock_response = AsyncMock()
        mock_response.status = 403
        mock_response.headers = {}
        mock_response.text = AsyncMock(return_value="Forbidden")
        mock_response.__aenter__ = AsyncMock(return_value=mock_response)
        mock_response.__aexit__ = AsyncMock(return_value=False)

        mock_session = AsyncMock()
        mock_session.get = MagicMock(return_value=mock_response)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        with patch(
            "app.utils.attachment_handler.aiohttp.ClientSession",
            return_value=mock_session,
        ):
            result = await handler.download_file(url="https://example.com/secret.png")

        assert result is None

    @pytest.mark.asyncio
    async def test_download_oversized_returns_none(self, tmp_path):
        """파일 크기 초과 시 None 반환"""
        handler = AttachmentHandler()
        handler.temp_dir = tmp_path

        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.headers = {
            "Content-Length": str(100 * 1024 * 1024),  # 100MB
            "Content-Type": "image/png",
        }
        mock_response.__aenter__ = AsyncMock(return_value=mock_response)
        mock_response.__aexit__ = AsyncMock(return_value=False)

        mock_session = AsyncMock()
        mock_session.get = MagicMock(return_value=mock_response)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        with patch(
            "app.utils.attachment_handler.aiohttp.ClientSession",
            return_value=mock_session,
        ):
            result = await handler.download_file(url="https://example.com/huge.png")

        assert result is None

    @pytest.mark.asyncio
    async def test_download_exception_returns_none(self, tmp_path):
        """네트워크 예외 시 None 반환"""
        handler = AttachmentHandler()
        handler.temp_dir = tmp_path

        with patch(
            "app.utils.attachment_handler.aiohttp.ClientSession",
            side_effect=Exception("Connection refused"),
        ):
            result = await handler.download_file(url="https://unreachable.com/file.png")

        assert result is None

    @pytest.mark.asyncio
    async def test_download_fallback_filename_in_saved_path(self, tmp_path):
        """fallback_filename이 저장 파일명에 반영되는지 확인"""
        handler = AttachmentHandler()
        handler.temp_dir = tmp_path

        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.headers = {"Content-Type": "image/png"}

        async def fake_iter_chunked(size):
            yield b"data"

        mock_response.content.iter_chunked = fake_iter_chunked
        mock_response.__aenter__ = AsyncMock(return_value=mock_response)
        mock_response.__aexit__ = AsyncMock(return_value=False)

        mock_session = AsyncMock()
        mock_session.get = MagicMock(return_value=mock_response)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=False)

        with patch(
            "app.utils.attachment_handler.aiohttp.ClientSession",
            return_value=mock_session,
        ):
            result = await handler.download_file(
                url="https://graph.microsoft.com/hostedContents/abc/$value",
                fallback_filename="my_image.png",
            )

        assert result is not None
        assert "my_image.png" in result


class TestCleanupFile:
    """파일 정리 테스트"""

    @pytest.mark.asyncio
    async def test_cleanup_existing_file(self, tmp_path):
        """존재하는 파일 삭제"""
        handler = AttachmentHandler()
        test_file = tmp_path / "test.txt"
        test_file.write_text("data")

        result = await handler.cleanup_file(str(test_file))
        assert result is True
        assert not test_file.exists()

    @pytest.mark.asyncio
    async def test_cleanup_nonexistent_file(self):
        """존재하지 않는 파일 삭제 시 False"""
        handler = AttachmentHandler()
        result = await handler.cleanup_file("/tmp/nonexistent_12345.txt")
        assert result is False


class TestSupportedTypes:
    """MIME 타입 지원 확인 테스트"""

    def test_supported_image_types(self):
        handler = AttachmentHandler()
        assert handler.is_supported_image("image/png") is True
        assert handler.is_supported_image("image/jpeg") is True
        assert handler.is_supported_image("image/gif") is True
        assert handler.is_supported_image("video/mp4") is False

    def test_supported_file_types(self):
        handler = AttachmentHandler()
        assert handler.is_supported_file("application/pdf") is True
        assert handler.is_supported_file("text/plain") is True
        assert handler.is_supported_file("application/x-custom") is False
