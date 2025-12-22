import { createFileRoute, useSearch, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useRef } from 'react';
import { exchangeCodeForToken, fetchMe } from '../server/auth';
import { clientConfig } from '../lib/client-config';
import { UserCard } from '../components/UserCard';

// Define the search params validation
type IndexSearch = {
	code?: string;
};

export const Route = createFileRoute('/')({
	validateSearch: (search: Record<string, unknown>): IndexSearch => {
		return {
			code: search.code as string | undefined,
		};
	},
	component: App,
});

function App() {
	// Use typed search params
	const { code } = useSearch({ from: Route.id });
	const navigate = useNavigate();

	const [user, setUser] = useState<any>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const processedCode = useRef<string | null>(null);

	useEffect(() => {
		const handleLogin = async () => {
			if (code && !user && processedCode.current !== code) {
				processedCode.current = code;
				setLoading(true);
				setError(null);
				try {
					// Exchange code for token
					const tokenData = await exchangeCodeForToken({ data: code } as any);
					console.log('Received token data:', tokenData);

					if (!tokenData || !tokenData.access_token) {
						throw new Error('Invalid token data received');
					}

					// Fetch user data
					const userData = await fetchMe({ data: tokenData.access_token } as any);
					setUser(userData);

					// Clear query params
					navigate({ to: '/', search: () => ({ code: undefined }), replace: true });
				} catch (err) {
					console.error(err);
					setError('Failed to login. Please try again.');
					processedCode.current = null;
				} finally {
					setLoading(false);
				}
			}
		};

		handleLogin();
	}, [code, navigate, user]);

	const handleLoginParams = new URLSearchParams({
		client_id: clientConfig.clientId,
		redirect_uri: clientConfig.redirectUri,
		response_type: 'code',
		// scope: 'public' // Add scopes if needed
	});

	return (
		<div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
			{/* Background effects */}
			<div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl -z-10 animate-pulse" />
			<div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl -z-10 animate-pulse delay-700" />

			<h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 mb-2 tracking-tight">
				42 WRAPPED
			</h1>
			<p className="text-slate-400 mb-12 text-lg text-center max-w-md">
				Discover your coding journey in 2025.
			</p>

			{error && (
				<div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
					{error}
				</div>
			)}

			{loading ? (
				<div className="flex flex-col items-center gap-4">
					<div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
					<p className="text-slate-400 animate-pulse">Authenticating...</p>
				</div>
			) : user ? (
				<UserCard user={user} />
			) : (
				<a
					href={`${clientConfig.authUrl}?${handleLoginParams.toString()}`}
					className="group relative inline-flex items-center justify-center px-8 py-3 font-semibold text-white transition-all duration-200 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 hover:scale-105 active:scale-95 shadow-xl hover:shadow-purple-500/20"
				>
					<span className="mr-2">Login with 42</span>
					<svg
						className="w-5 h-5 transition-transform group-hover:translate-x-1"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
					</svg>
				</a>
			)}

			<footer className="absolute bottom-4 text-slate-600 text-sm">
				Built for the community
			</footer>
		</div>
	);
}
