import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import { Server, WebSocket } from 'ws';

type Socket = WebSocket & { roomId: string; name: string };

@WebSocketGateway(8080)
export class EventsGateway
  implements OnGatewayConnection, OnGatewayInit, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  rooms: string[] = [];

  afterInit() {
    this.rooms = [];
    console.log('websocket server start');
  }

  public handleConnection(client: Socket) {
    this.server.clients.add(client);
  }

  public handleDisconnect(client: Socket) {
    const roomId = client.roomId;

    this.server.clients.delete(client);
    let isRoomEmpty = true;

    this.server.clients.forEach((socket: Socket) => {
      if (this.rooms.includes(socket.roomId)) {
        isRoomEmpty = false;
      }
    });

    if (isRoomEmpty) {
      this.rooms.filter((room) => room !== client.roomId);
    } else {
      const usersOfRoom = [];

      this.server.clients.forEach((socket: Socket) => {
        if (socket.roomId === roomId) {
          usersOfRoom.push(socket.name);
        }
      });

      this.server.clients.forEach((socket: Socket) => {
        if (client.roomId === socket.roomId) {
          socket.send(
            JSON.stringify({
              event: 'user-disconnect',
              data: { users: usersOfRoom },
            }),
          );
        }
      });
    }
  }

  @SubscribeMessage('entry-to-room')
  onConnect(
    client: Socket,
    { roomId, name }: { roomId: string; name: string },
  ) {
    client.roomId = roomId;
    client.name = name;

    if (this.rooms.includes(roomId)) {
      const usersOfRoom = [];

      this.server.clients.forEach((socket: Socket) => {
        if (socket.roomId === roomId) {
          usersOfRoom.push(socket.name);
        }
      });

      this.server.clients.forEach((socket: Socket) => {
        if (client.roomId === socket.roomId) {
          socket.send(
            JSON.stringify({
              event: 'entry-to-room',
              data: { name, roomId, users: usersOfRoom },
            }),
          );
        }
      });
    } else {
      this.rooms.push(roomId);
      client.send(
        JSON.stringify({
          event: 'entry-to-room',
          data: { name, roomId, users: [name] },
        }),
      );
    }
  }

  @SubscribeMessage('paint')
  onPaint(client: Socket, data: any) {
    this.server.clients.forEach((socket: Socket) => {
      if (client.roomId === socket.roomId) {
        socket.send(
          JSON.stringify({
            event: 'paint',
            data,
          }),
        );
      }
    });
  }

  @SubscribeMessage('message')
  onMessage(client: Socket, data: any) {
    this.server.clients.forEach((socket: Socket) => {
      if (client.roomId === socket.roomId) {
        socket.send(
          JSON.stringify({
            event: 'message',
            data:
              client === socket
                ? {
                    ...data,
                    author: true,
                  }
                : data,
          }),
        );
      }
    });
  }
}
