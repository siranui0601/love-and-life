export const socket=io({auth:{username:localStorage.getItem('ll_username')||'名無し',clientId:localStorage.getItem('nohand_client')||(localStorage.nohand_client=crypto.randomUUID())}});
export const call=(ev,p={})=>new Promise(r=>socket.emit(ev,p,r));
