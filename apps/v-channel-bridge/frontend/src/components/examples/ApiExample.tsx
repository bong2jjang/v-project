/**
 * API 사용 예제 컴포넌트
 *
 * v-channel-bridge API와 Config API의 기본 사용법을 보여주는 예제
 */

import { useEffect } from "react";
import { useBridgeStore, useConfigStore } from "../../store";

export function ApiExample() {
  const {
    status,
    logs,
    isLoading: bridgeLoading,
    error: bridgeError,
    fetchStatus,
    start,
    stop,
    restart,
    fetchLogs,
    clearError: clearBridgeError,
  } = useBridgeStore();

  const {
    config,
    validation,
    backups,
    isLoading: configLoading,
    error: configError,
    fetchConfig,
    validateConfig,
    fetchBackups,
    createBackup,
    clearError: clearConfigError,
  } = useConfigStore();

  useEffect(() => {
    // 컴포넌트 마운트 시 초기 데이터 로딩
    fetchStatus();
    fetchConfig();
    fetchBackups();
    fetchLogs(50);
  }, [fetchStatus, fetchConfig, fetchBackups, fetchLogs]);

  const handleStart = async () => {
    try {
      await start();
      alert("v-channel-bridge started successfully!");
    } catch (error) {
      // 에러는 store에서 자동으로 처리됨
    }
  };

  const handleStop = async () => {
    try {
      await stop();
      alert("v-channel-bridge stopped successfully!");
    } catch (error) {
      // 에러는 store에서 자동으로 처리됨
    }
  };

  const handleRestart = async () => {
    try {
      await restart();
      alert("v-channel-bridge restarted successfully!");
    } catch (error) {
      // 에러는 store에서 자동으로 처리됨
    }
  };

  const handleValidate = async () => {
    const isValid = await validateConfig();
    if (isValid) {
      alert("Configuration is valid!");
    } else {
      alert("Configuration is invalid. Check validation errors.");
    }
  };

  const handleCreateBackup = async () => {
    await createBackup();
    alert("Backup created successfully!");
  };

  if (bridgeLoading || configLoading) {
    return (
      <div className="p-4">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">API Example</h1>

      {/* Bridge Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-800">
          Bridge Control
        </h2>

        {bridgeError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <p className="text-red-800">{bridgeError}</p>
              <button
                onClick={clearBridgeError}
                className="text-red-600 hover:text-red-800"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Status</h3>
            {status ? (
              <div className="space-y-2">
                <p>
                  <span className="font-medium">Running:</span>{" "}
                  <span
                    className={
                      status.running ? "text-green-600" : "text-red-600"
                    }
                  >
                    {status.running ? "Yes" : "No"}
                  </span>
                </p>
                {status.pid && (
                  <p>
                    <span className="font-medium">PID:</span> {status.pid}
                  </p>
                )}
                {status.uptime && (
                  <p>
                    <span className="font-medium">Uptime:</span> {status.uptime}
                  </p>
                )}
                <p>
                  <span className="font-medium">Version:</span> {status.version}
                </p>
                <p>
                  <span className="font-medium">Container Status:</span>{" "}
                  {status.container_status}
                </p>
              </div>
            ) : (
              <p className="text-gray-500">No status available</p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleStart}
              disabled={bridgeLoading}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              Start
            </button>
            <button
              onClick={handleStop}
              disabled={bridgeLoading}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              Stop
            </button>
            <button
              onClick={handleRestart}
              disabled={bridgeLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Restart
            </button>
            <button
              onClick={fetchStatus}
              disabled={bridgeLoading}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Recent Logs
            </h3>
            <div className="bg-gray-50 rounded p-4 max-h-64 overflow-y-auto">
              {logs.length > 0 ? (
                <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                  {logs.join("\n")}
                </pre>
              ) : (
                <p className="text-gray-500">No logs available</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Config Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-gray-800">Configuration</h2>

        {configError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <p className="text-red-800">{configError}</p>
              <button
                onClick={clearConfigError}
                className="text-red-600 hover:text-red-800"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Current Config
            </h3>
            {config ? (
              <div className="bg-gray-50 rounded p-4 max-h-96 overflow-y-auto">
                <pre className="text-sm text-gray-800">
                  {JSON.stringify(config, null, 2)}
                </pre>
              </div>
            ) : (
              <p className="text-gray-500">No config available</p>
            )}
          </div>

          {validation && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Validation Result
              </h3>
              <div
                className={`border rounded p-4 ${
                  validation.valid
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                }`}
              >
                <p className="font-medium">
                  {validation.valid ? "✓ Valid" : "✗ Invalid"}
                </p>
                {validation.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="font-medium text-red-800">Errors:</p>
                    <ul className="list-disc list-inside text-red-700">
                      {validation.errors.map((error, idx) => (
                        <li key={idx}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {validation.warnings.length > 0 && (
                  <div className="mt-2">
                    <p className="font-medium text-yellow-800">Warnings:</p>
                    <ul className="list-disc list-inside text-yellow-700">
                      {validation.warnings.map((warning, idx) => (
                        <li key={idx}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleValidate}
              disabled={configLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Validate
            </button>
            <button
              onClick={handleCreateBackup}
              disabled={configLoading}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
            >
              Create Backup
            </button>
            <button
              onClick={fetchConfig}
              disabled={configLoading}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Backups</h3>
            {backups.length > 0 ? (
              <div className="space-y-2">
                {backups.slice(0, 5).map((backup, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-gray-50 rounded p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {backup.path.split("/").pop()}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(backup.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
                {backups.length > 5 && (
                  <p className="text-sm text-gray-500">
                    ... and {backups.length - 5} more
                  </p>
                )}
              </div>
            ) : (
              <p className="text-gray-500">No backups available</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
