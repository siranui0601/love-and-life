import express from 'express';
import {mountPersistentWorldRoutes} from '../../src/server/trpg/world/routes.js';
import {installWorldShutdown} from '../../src/server/trpg/world/shutdown.js';
const app=express();const service=mountPersistentWorldRoutes(app);app.use(express.static('public'));
const server=app.listen(Number(process.env.PORT||3100),'127.0.0.1',()=>console.log('Persistent World: http://127.0.0.1:3100/TRPG/'));
installWorldShutdown({httpServer:server,service});
