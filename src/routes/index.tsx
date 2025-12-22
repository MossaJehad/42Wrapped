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

		<div className="min-h-screen bg-[oklch(0.05_0_0)] flex flex-col items-center justify-center p-4 relative overflow-hidden font-anton selection:bg-[var(--neon-green)] selection:text-black">
			{/* Grain Overlay */}
			<div className="bg-grain fixed inset-0 opacity-20 pointer-events-none" />

			{/* Abstract Geometric Shapes */}
			<div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
				<div className="absolute top-10 -left-10 w-64 h-64 bg-[var(--neon-green)] rounded-full blur-[80px] opacity-10 mix-blend-screen animate-pulse" />
				<div className="absolute bottom-20 right-10 w-40 h-80 bg-white opacity-5 rotate-12" />
				<div className="absolute top-1/3 right-1/4 w-32 h-32 border-4 border-[var(--neon-green)] rounded-full opacity-20" />
			</div>

			{/* Scrolling Background Text (Static in this version, could be animated) */}
			<div className="absolute inset-0 flex flex-col justify-between opacity-5 select-none pointer-events-none leading-none overflow-hidden">
				{Array.from({ length: 5 }).map((_, i) => (
					<div key={i} className="text-[12vw] whitespace-nowrap text-white font-black italic tracking-tighter transform -rotate-2 scale-110">
						42 WRAPPED 2025 42 WRAPPED 2025
					</div>
				))}
			</div>

			{/* Main Content */}
			<div className="relative z-20 flex flex-col items-center text-center max-w-4xl w-full">
				<h1 className="text-[15vw] leading-[0.85] font-black text-white mix-blend-difference italic tracking-tighter mb-4 transform -skew-x-6">
					42<br /><span className="text-transparent stroke-text">WRAPPED</span>
				</h1>

				<p className="text-xl md:text-2xl text-[var(--neon-green)] font-bold tracking-widest uppercase mb-12 bg-black/80 px-4 py-2 border border-[var(--neon-green)] transform skew-x-6 backdrop-blur-sm">
					Your 2025 Coding Visualized
				</p>

				{error && (
					<div className="mb-8 p-6 bg-red-600 text-black font-bold border-4 border-black shadow-[8px_8px_0px_0px_rgba(255,255,255,1)]">
						{error}
					</div>
				)}

				<div className="relative group">
					<div className="absolute inset-0 bg-[var(--neon-green)] transform translate-x-2 translate-y-2 group-hover:translate-x-4 group-hover:translate-y-4 transition-transform duration-200" />

					{loading ? (
						<div className="relative bg-black border-2 border-[var(--neon-green)] px-12 py-4 flex items-center gap-4">
							<div className="w-6 h-6 border-4 border-[var(--neon-green)] border-t-transparent rounded-full animate-spin" />
							<span className="text-[var(--neon-green)] text-xl tracking-wider">SYNCING DATA...</span>
						</div>
					) : user ? (
						<UserCard user={user} />
					) : (
						<a
							href={`${clientConfig.authUrl}?${handleLoginParams.toString()}`}
							className="relative block bg-black border-2 border-white px-12 py-5 text-white text-2xl font-black italic tracking-widest hover:bg-white hover:text-black transition-colors duration-200"
						>
							LOGIN WITH 42
						</a>
					)}
				</div>
			</div>

			{/* Footer */}
			<footer className="absolute bottom-6 w-full text-center">
				<p className="text-white/40 text-sm font-sans tracking-widest uppercase">
					Experimental Build v0.1 • 42 Network
				</p>
			</footer>

			<style>{`
				.stroke-text {
					-webkit-text-stroke: 2px white;
				}
			`}</style>
		</div>
	);
}
