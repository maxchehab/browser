import nock from "nock";
import RoomServiceClient from "./client";
import Sockets from "./socket";

const URL = "https://coolsite.com";
jest.mock("idb-keyval");

function mockAuthEndpoint() {
  return nock(URL)
    .post("/api/roomservice")
    .reply(200, {
      room: {
        id: "id",
        reference: "my-room",
        state: "{}"
      },
      session: {
        token: "short-lived-token"
      }
    });
}

describe("RoomServiceClient", () => {
  const scope = mockAuthEndpoint();

  // @ts-ignore
  jest.spyOn(Sockets, "newSocket").mockImplementation(() => ({
    on: jest.fn()
  }));

  it("should call the authorization endpoint when creating a room", async () => {
    const client = new RoomServiceClient(URL + "/api/roomservice");
    const room = client.room("my-room");

    await room.connect();

    expect(scope.isDone()).toBeTruthy();
  });

  test("room gets called with bearer token", async () => {
    mockAuthEndpoint();
    const mock = jest
      .spyOn(Sockets, "newSocket")
      .mockImplementation((url, connectopts) => {
        // @ts-ignore
        return { on: jest.fn() } as SocketIOClient.Socket;
      }).mock;

    const client = new RoomServiceClient(URL + "/api/roomservice");
    const room = client.room("my-room");
    await room.connect();
    const [url, args] = mock.calls[0];

    expect(url).toBe("https://api.roomservice.dev");

    // @ts-ignore because bad typings make me sad
    expect(args.transportOptions!.polling.extraHeaders.authorization).toBe(
      "Bearer short-lived-token"
    );
  });

  test("room.publish() can change a document", async () => {
    mockAuthEndpoint();

    const emit = jest.fn();

    jest
      .spyOn(Sockets, "newSocket")
      // @ts-ignore because typescript doesn't like our deep testing magic
      .mockImplementation((url, connectopts) => {
        return {
          emit,
          on: jest.fn()
        };
      });

    const client = new RoomServiceClient(URL + "/api/roomservice");
    const room = client.room("my-room");
    await room.connect();

    const newState = room.publishState(prevState => {
      prevState.someOption = "hello!";
    });

    expect(newState.someOption).toBe("hello!");
  });
});
