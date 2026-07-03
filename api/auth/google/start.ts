declare const require: any;

const googleAuth = require('../../../server/googleAuth');

export async function GET(request: Request): Promise<Response> {
  try {
    const origin = googleAuth.getOriginFromRequestUrl(request.url);
    return googleAuth.redirectResponse(googleAuth.createAuthorizationUrl(origin));
  } catch {
    return googleAuth.redirectResponse('/?authError=google_config');
  }
}
