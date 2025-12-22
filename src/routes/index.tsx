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
		<div className="min-h-screen bg-background flex flex-col items-center justify-between p-6 relative overflow-hidden font-sans">
			{/* Geometric Background Elements */}
			<div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
				{/* Concentric Circles Effect */}
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border-[40px] border-primary/20 rounded-full opacity-50" />
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border-[40px] border-primary/20 rounded-full opacity-50 delay-100" />
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border-[40px] border-primary/20 rounded-full opacity-50 delay-200" />

				{/* Stripes or decorative elements */}
				<div className="absolute top-10 right-10 w-24 h-24 bg-primary rounded-full blur-3xl opacity-20" />
				<div className="absolute bottom-10 left-10 w-32 h-32 bg-white/10 rounded-full blur-3xl opacity-20" />
			</div>

			{/* Main Content */}
			<div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-sm mx-auto text-center gap-8">
				<div className="space-y-2">
					<h1 className="text-7xl md:text-9xl font-black text-primary leading-[0.85] tracking-tighter mix-blend-screen font-spotify"
						style={{ transform: 'scale(1.27, 1)', display: 'inline-block' }}
					>
						42
						<br />
						<span className="text-foreground">Wrapped</span>
					</h1>
					<p className="text-muted-foreground/80 text-xl md:text-2xl font-bold tracking-tight font-spotify pt-4">
						2025 EDITION
					</p>
				</div>

				<p className="text-lg font-medium text-foreground/80 max-w-xs">
					Unwrap your coding stats.
					<br />
					See how you performed this year.
				</p>

				{error && (
					<div className="w-full p-4 bg-destructive/10 border-2 border-destructive text-destructive font-bold rounded-xl text-sm">
						{error}
					</div>
				)}

				<div className="mt-8 w-full">
					{loading ? (
						<div className="flex flex-col items-center gap-4">
							<div className="w-12 h-12 border-8 border-primary border-t-transparent rounded-full animate-spin" />
							<p className="text-primary font-bold animate-pulse text-xl">LOADING...</p>
						</div>
					) : user ? (
						<UserCard user={user} />
					) : (
						<a
							href={`${clientConfig.authUrl}?${handleLoginParams.toString()}`}
							className="group relative inline-flex items-center justify-center w-full px-8 py-4 text-xl font-black text-primary-foreground bg-primary rounded-full transition-all duration-300 hover:scale-105 hover:shadow-[0_0_10px_-5px_var(--color-primary)] active:scale-95"
						>
							<span className="mr-2">CONNECT INTRA</span>
							<svg
								className="w-6 h-6 transition-transform group-hover:translate-x-1"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" />
							</svg>
						</a>
					)}
				</div>
			</div>

			<footer className="relative z-10 py-4 text-muted-foreground font-mono text-xs uppercase tracking-widest">
				Made for <img src="https://www.42network.org/wp-content/uploads/2024/04/42.svg" alt="42" className="inline-block w-6" /> Students
			</footer>
		</div>
	);
}
