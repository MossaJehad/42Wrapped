export const getRedirectUri = () => {
	if (typeof window !== 'undefined' && window.location?.origin) {
		return window.location.origin;
	}
	return (import.meta as any).env?.VITE_REDIRECT_URI || "https://42wrapped.up.railway.app";
};

export const clientConfig = {
	clientId:
		(import.meta as any).env?.VITE_FORTYTWO_CLIENT_ID ||
		"u-s4t2ud-f874fb5ceb132974789c26fb2385748975147072bc9b71a425a14cb175581281",
	get redirectUri() {
		return getRedirectUri();
	},
	authUrl: "https://api.intra.42.fr/oauth/authorize",
	tokenUrl: "https://api.intra.42.fr/oauth/token",
	meUrl: "https://api.intra.42.fr/v2/me",
};
