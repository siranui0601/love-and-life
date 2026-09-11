/** Stop accepting connections, drain world commands, flush saves, then close sockets. */
export function installWorldShutdown({ httpServer, service, io, timeoutMs = 25_000, processHandle = process }) {
  let shutdown;
  const stop = signal => {
    if (shutdown) return shutdown;
    const timeout = setTimeout(() => {
      console.error(`Shutdown exceeded ${timeoutMs} ms after ${signal}; check persistent storage.`);
      httpServer.closeAllConnections?.();
      processHandle.exit(1);
    }, timeoutMs);
    timeout.unref?.();
    shutdown = (async () => {
      let closeHttp;
      const drained = new Promise(resolve => { closeHttp = resolve; });
      httpServer.close(error => closeHttp(error));
      httpServer.closeIdleConnections?.();
      let failure;
      try { await service?.close(); } catch (error) { failure = error; console.error('World save on shutdown failed:', error); }
      if (io) await new Promise(resolve => io.close(resolve));
      const httpError = await drained;
      clearTimeout(timeout);
      processHandle.exit(failure || (httpError && httpError.code !== 'ERR_SERVER_NOT_RUNNING') ? 1 : 0);
    })();
    return shutdown;
  };
  processHandle.once('SIGTERM', stop);
  processHandle.once('SIGINT', stop);
  return stop;
}
