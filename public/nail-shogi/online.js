const API = "/api/nail-shogi/rooms";

function loadCurrentUser() {
  try { return JSON.parse(localStorage.getItem("currentUser") || "null"); }
  catch { return null; }
}

export function getOnlineIdentity() {
  const user = loadCurrentUser();
  let clientId = user?.userTrackingId || localStorage.getItem("nailShogiClientId") || "";
  if (!clientId) {
    clientId = crypto.randomUUID?.() || `nail-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem("nailShogiClientId", clientId);
  }
  const username = user?.username || localStorage.getItem("username") || `ゲスト${clientId.slice(-4)}`;
  return { clientId, username };
}

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  let data = null;
  try { data = await response.json(); } catch { data = {}; }
  if (!response.ok || data?.ok === false) {
    const error = new Error(data?.error || `http_${response.status}`);
    error.status = response.status;
    error.payload = data;
    throw error;
  }
  return data;
}

export class NailOnlineClient {
  constructor({ onRoom, onError } = {}) {
    this.identity = getOnlineIdentity();
    this.roomId = null;
    this.version = 0;
    this.you = null;
    this.room = null;
    this.onRoom = onRoom || (() => {});
    this.onError = onError || (() => {});
    this.pollTimer = null;
    this.socket = typeof window.io === "function" ? window.io() : null;
    this.socket?.on("nail-shogi:room", (room) => {
      if (!room || room.roomId !== this.roomId) return;
      this.acceptRoom(room, null, "socket");
    });
    this.socket?.on("connect", () => {
      if (this.roomId) {
        this.socket.emit("nail-shogi:subscribe", { roomId: this.roomId });
        this.refresh().catch(() => {});
      }
    });
  }

  acceptRoom(room, you = null, source = "rest") {
    if (!room) return;
    if (room.version < this.version) return;
    this.roomId = room.roomId;
    this.version = room.version;
    this.room = room;
    if (you) this.you = you;
    this.onRoom({ room, you: this.you, source });
  }

  subscribe(roomId) {
    if (this.roomId && this.roomId !== roomId) this.socket?.emit("nail-shogi:unsubscribe", { roomId: this.roomId });
    this.roomId = String(roomId);
    this.socket?.emit("nail-shogi:subscribe", { roomId: this.roomId });
    clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => this.refresh().catch(() => {}), 3000);
  }

  async create() {
    const data = await jsonFetch(`${API}/create`, {
      method: "POST",
      body: JSON.stringify({ ...this.identity }),
    });
    this.subscribe(data.room.roomId);
    this.acceptRoom(data.room, data.you, "create");
    return data;
  }

  async join(roomId) {
    const clean = String(roomId || "").replace(/\D/g, "").slice(0, 4);
    if (clean.length !== 4) throw new Error("room_id_invalid");
    const data = await jsonFetch(`${API}/join`, {
      method: "POST",
      body: JSON.stringify({ roomId: clean, ...this.identity }),
    });
    this.subscribe(data.room.roomId);
    this.acceptRoom(data.room, data.you, "join");
    return data;
  }

  async reconnect(roomId) {
    const clean = String(roomId || "").replace(/\D/g, "").slice(0, 4);
    if (clean.length !== 4) return null;
    this.subscribe(clean);
    const data = await jsonFetch(`${API}/${clean}?clientId=${encodeURIComponent(this.identity.clientId)}`);
    if (!data.you) throw new Error("not_a_member");
    this.acceptRoom(data.room, data.you, "reconnect");
    return data;
  }

  async refresh() {
    if (!this.roomId) return null;
    const data = await jsonFetch(`${API}/${this.roomId}?clientId=${encodeURIComponent(this.identity.clientId)}`);
    this.acceptRoom(data.room, data.you, "poll");
    return data;
  }

  async start() {
    if (!this.roomId) throw new Error("room_not_found");
    const data = await jsonFetch(`${API}/${this.roomId}/start`, {
      method: "POST",
      body: JSON.stringify({ clientId: this.identity.clientId }),
    });
    this.acceptRoom(data.room, data.you, "start");
    return data;
  }

  async command({ directions, cares }) {
    if (!this.roomId) throw new Error("room_not_found");
    try {
      const data = await jsonFetch(`${API}/${this.roomId}/command`, {
        method: "POST",
        body: JSON.stringify({
          clientId: this.identity.clientId,
          expectedVersion: this.version,
          directions,
          cares,
        }),
      });
      this.acceptRoom(data.room, data.you, "command");
      return data;
    } catch (error) {
      if (error.status === 409 && error.payload?.room) {
        this.acceptRoom(error.payload.room, error.payload.you, "stale");
      }
      throw error;
    }
  }

  async rematch() {
    if (!this.roomId) throw new Error("room_not_found");
    const data = await jsonFetch(`${API}/${this.roomId}/rematch`, {
      method: "POST",
      body: JSON.stringify({ clientId: this.identity.clientId }),
    });
    this.acceptRoom(data.room, data.you, "rematch");
    return data;
  }

  async leave() {
    const roomId = this.roomId;
    if (!roomId) return;
    this.socket?.emit("nail-shogi:unsubscribe", { roomId });
    clearInterval(this.pollTimer);
    this.pollTimer = null;
    this.roomId = null;
    this.room = null;
    this.version = 0;
    const clientId = this.identity.clientId;
    try {
      await jsonFetch(`${API}/${roomId}/leave`, {
        method: "POST",
        body: JSON.stringify({ clientId }),
      });
    } catch (error) {
      this.onError(error);
    }
  }

  destroy() {
    clearInterval(this.pollTimer);
    this.pollTimer = null;
    if (this.roomId) this.socket?.emit("nail-shogi:unsubscribe", { roomId: this.roomId });
  }
}

export function onlineErrorMessage(error) {
  const code = error?.message || "";
  const messages = {
    room_id_invalid: "部屋番号は4桁で入力してください。",
    room_not_found: "その部屋は見つかりませんでした。",
    room_full: "その部屋は満員です。",
    game_already_started: "その部屋はすでに対局中です。",
    host_only: "この操作は部屋を作った人だけができます。",
    need_two_players: "相手が入るまで待ってください。",
    not_your_turn: "いまは相手の操作中です。",
    stale_state: "相手の操作が先に届きました。盤面を更新しました。",
    not_a_member: "この端末では、その部屋に参加していません。",
  };
  return messages[code] || "通信に失敗しました。少し待ってもう一度お試しください。";
}
