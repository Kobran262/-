import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

WebBrowser.maybeCompleteAuthSession();

const GDRIVE_TOKEN_KEY = 'srecha_gdrive_token';
const GDRIVE_REFRESH_KEY = 'srecha_gdrive_refresh';
const GDRIVE_EXPIRES_KEY = 'srecha_gdrive_expires';
const GDRIVE_EMAIL_KEY = 'srecha_gdrive_email';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

function getClientId(): string | undefined {
  return Constants.expoConfig?.extra?.GOOGLE_OAUTH_CLIENT_ID as string | undefined;
}

/** Redirect URI for Google OAuth (iOS client ID → reversed scheme). */
function getGoogleRedirectUri(clientId: string): string {
  if (clientId.endsWith('.apps.googleusercontent.com')) {
    const prefix = clientId.replace('.apps.googleusercontent.com', '');
    return `com.googleusercontent.apps.${prefix}:/oauth2redirect`;
  }
  return AuthSession.makeRedirectUri({ scheme: 'srechawms' });
}

async function fetchUserEmail(accessToken: string): Promise<string | undefined> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { email?: string };
    return data.email;
  } catch {
    return undefined;
  }
}

async function storeTokens(
  accessToken: string,
  refreshToken: string | undefined,
  expiresIn: number,
  email?: string
): Promise<void> {
  const expiresAt = Date.now() + expiresIn * 1000;
  await SecureStore.setItemAsync(GDRIVE_TOKEN_KEY, accessToken);
  if (refreshToken) {
    await SecureStore.setItemAsync(GDRIVE_REFRESH_KEY, refreshToken);
  }
  await SecureStore.setItemAsync(GDRIVE_EXPIRES_KEY, String(expiresAt));
  if (email) {
    await SecureStore.setItemAsync(GDRIVE_EMAIL_KEY, email);
  }
}

export async function signInWithGoogle(): Promise<boolean> {
  const clientId = getClientId();
  if (!clientId) return false;

  const redirectUri = getGoogleRedirectUri(clientId);

  const request = new AuthSession.AuthRequest({
    clientId,
    scopes: [SCOPE, 'openid', 'email'],
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
  });

  const result = await request.promptAsync(discovery);

  if (result.type !== 'success' || !result.params.code) {
    return false;
  }

  const tokenRes = await AuthSession.exchangeCodeAsync(
    {
      clientId,
      code: result.params.code,
      redirectUri,
      extraParams: { code_verifier: request.codeVerifier ?? '' },
    },
    discovery
  );

  const email = await fetchUserEmail(tokenRes.accessToken);
  await storeTokens(
    tokenRes.accessToken,
    tokenRes.refreshToken,
    tokenRes.expiresIn ?? 3600,
    email
  );

  return true;
}

async function refreshAccessToken(): Promise<string | null> {
  const clientId = getClientId();
  const refreshToken = await SecureStore.getItemAsync(GDRIVE_REFRESH_KEY);
  if (!clientId || !refreshToken) return null;

  try {
    const res = await fetch(discovery.tokenEndpoint!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
    };

    await storeTokens(
      data.access_token,
      data.refresh_token ?? refreshToken,
      data.expires_in ?? 3600
    );

    return data.access_token;
  } catch {
    return null;
  }
}

export async function getValidAccessToken(): Promise<string | null> {
  const token = await SecureStore.getItemAsync(GDRIVE_TOKEN_KEY);
  const expiresStr = await SecureStore.getItemAsync(GDRIVE_EXPIRES_KEY);

  if (!token) return null;

  const expiresAt = expiresStr ? parseInt(expiresStr, 10) : 0;
  if (Date.now() < expiresAt - 60_000) {
    return token;
  }

  return refreshAccessToken();
}

export async function signOutGoogle(): Promise<void> {
  await SecureStore.deleteItemAsync(GDRIVE_TOKEN_KEY);
  await SecureStore.deleteItemAsync(GDRIVE_REFRESH_KEY);
  await SecureStore.deleteItemAsync(GDRIVE_EXPIRES_KEY);
  await SecureStore.deleteItemAsync(GDRIVE_EMAIL_KEY);
}

export async function isGoogleConnected(): Promise<boolean> {
  const token = await SecureStore.getItemAsync(GDRIVE_TOKEN_KEY);
  return !!token;
}

export async function getGoogleEmail(): Promise<string | null> {
  return SecureStore.getItemAsync(GDRIVE_EMAIL_KEY);
}
