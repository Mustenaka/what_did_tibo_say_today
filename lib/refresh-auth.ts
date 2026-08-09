import { getRuntimeEnv } from "./runtime-env";

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export function isAuthorizedRefresh(request: Request) {
  const secret = getRuntimeEnv().REFRESH_SECRET?.trim();
  if (!secret) return false;
  const authorization = request.headers.get("authorization") || "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  return constantTimeEqual(supplied, secret);
}
