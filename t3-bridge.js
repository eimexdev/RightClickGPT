(() => {
  const NativeWebSocket = window.WebSocket;
  if (!NativeWebSocket || NativeWebSocket.__rightClickGPTT3Bridge) {
    return;
  }

  let knownSessionId = '';
  const SESSION_SCOPED_UDF = /^(account:|profiles:|threads:|messages:)/;

  function visitObjects(value, callback) {
    if (!value || typeof value !== 'object') {
      return;
    }

    callback(value);

    if (Array.isArray(value)) {
      value.forEach((item) => visitObjects(item, callback));
      return;
    }

    Object.values(value).forEach((item) => visitObjects(item, callback));
  }

  function rememberSessionId(message) {
    visitObjects(message, (object) => {
      if (typeof object.sessionId === 'string' && object.sessionId) {
        knownSessionId = object.sessionId;
      }
    });
  }

  function shouldPatchUdf(udfPath) {
    return SESSION_SCOPED_UDF.test(String(udfPath || ''));
  }

  function patchArg(arg) {
    if (!knownSessionId || !arg || typeof arg !== 'object' || arg.sessionId) {
      return false;
    }

    arg.sessionId = knownSessionId;
    return true;
  }

  function patchPayload(payload) {
    try {
      const message = JSON.parse(payload);
      let changed = false;

      rememberSessionId(message);

      if (Array.isArray(message.modifications)) {
        message.modifications.forEach((modification) => {
          if (!shouldPatchUdf(modification && modification.udfPath)) {
            return;
          }

          const arg = Array.isArray(modification.args) ? modification.args[0] : null;
          changed = patchArg(arg) || changed;
        });
      }

      if (shouldPatchUdf(message.udfPath)) {
        const arg = Array.isArray(message.args) ? message.args[0] : null;
        changed = patchArg(arg) || changed;
      }

      rememberSessionId(message);
      return changed ? JSON.stringify(message) : payload;
    } catch (error) {
      return payload;
    }
  }

  class RightClickGPTWebSocket extends NativeWebSocket {
    send(data) {
      if (typeof data === 'string') {
        data = patchPayload(data);
      }

      return super.send(data);
    }
  }

  Object.getOwnPropertyNames(NativeWebSocket).forEach((key) => {
    try {
      RightClickGPTWebSocket[key] = NativeWebSocket[key];
    } catch (error) {
      // Some WebSocket properties are read-only in Chromium.
    }
  });

  Object.defineProperty(RightClickGPTWebSocket, '__rightClickGPTT3Bridge', {
    value: true,
  });

  window.WebSocket = RightClickGPTWebSocket;
})();
