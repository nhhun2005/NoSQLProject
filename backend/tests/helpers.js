export const createMockReqRes = ({
  body = {},
  params = {},
  headers = {},
  user = null,
  ip = "127.0.0.1",
  path = "/"
} = {}) => {
  const req = {
    body,
    params,
    headers,
    user,
    ip,
    path,
    socket: {
      remoteAddress: ip
    }
  };
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    }
  };
  return {
    req,
    res
  };
};
