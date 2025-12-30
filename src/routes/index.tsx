import { createFileRoute, useSearch, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { exchangeCodeForToken, fetchMe, fetchUserAchievements, fetchLocations, fetchScaleTeams, fetchTeams } from '../server/auth';
import { clientConfig } from '../lib/client-config';
import { StoryMode } from '../components/StoryMode';

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
	const [achievements, setAchievements] = useState<any[]>([]);
	const [locations, setLocations] = useState<any[]>([]);
	const [evaluations, setEvaluations] = useState<any[]>([]);
	const [teams, setTeams] = useState<any[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

	const processedCode = useRef<string | null>(null);

	useEffect(() => {
		const handleLogin = async () => {
			if (code && !user && processedCode.current !== code) {
				processedCode.current = code;
				setLoading(true);
				setError(null);

				// Start timer for minimum loading duration (show at least a few messages)
				const minLoadingTime = new Promise(resolve => setTimeout(resolve, 4400));

				try {
					// Exchange code for token
					const tokenData = await exchangeCodeForToken({ data: code } as any);

					if (!tokenData || !tokenData.access_token) {
						throw new Error('Invalid token data received');
					}

					// Fetch user data
					const userData = await fetchMe({ data: tokenData.access_token } as any);
					setUser(userData);

					// Fetch user achievements
					try {
						const achievementsData = await fetchUserAchievements({
							data: {
								token: tokenData.access_token,
								userId: userData.id
							}
						} as any);
						setAchievements(achievementsData || []);
					} catch (achError) {
						console.error("Failed to fetch achievements", achError);
						// Don't block login if achievements fail
					}

					// Fetch locations
					try {
						const locs = await fetchLocations({
							data: {
								token: tokenData.access_token,
								userId: userData.id
							}
						} as any);
						setLocations(locs || []);
					} catch (locError) {
						console.error("Failed to fetch locations", locError);
					}

					// Fetch evaluations
					try {
						const evals = await fetchScaleTeams({
							data: {
								token: tokenData.access_token,
								userId: userData.id
							}
						} as any);
						setEvaluations(evals || []);
					} catch (evalError) {
						console.error("Failed to fetch evaluations", evalError);
					}

					// Fetch teams
					try {
						const teamsData = await fetchTeams({
							data: {
								token: tokenData.access_token,
								userId: userData.id
							}
						} as any);
						setTeams(teamsData || []);
					} catch (teamError) {
						console.error("Failed to fetch teams", teamError);
					}

				// Wait for minimum loading time before finishing
				await minLoadingTime;

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

	// Cycle loading messages
	useEffect(() => {
		if (!loading) return;
		const interval = setInterval(() => {
			setLoadingMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
		}, 2500); // 2.5s per message for nice cycling
		return () => clearInterval(interval);
	}, [loading]);

	const handleLoginParams = new URLSearchParams({
		client_id: clientConfig.clientId,
		redirect_uri: clientConfig.redirectUri,
		response_type: 'code',
		// scope: 'public' // Add scopes if needed
	});

	// If user is logged in, show the Story Mode
	if (user) {
		return <StoryMode user={user} achievements={achievements} locations={locations} evaluations={evaluations} teams={teams} />;
	}

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
						<div className="flex flex-col items-center gap-6 h-32 justify-center">
							<div className="relative">
								<div className="w-16 h-16 border-8 border-primary/20 border-t-primary rounded-full animate-spin" />
								<div className="absolute inset-0 flex items-center justify-center font-mono text-xs font-bold opacity-50">42</div>
							</div>

							<div className="h-8 relative w-full max-w-[300px] flex justify-center overflow-hidden">
								<AnimatePresence mode='wait'>
									<LoadingText key={loadingMessageIndex} message={LOADING_MESSAGES[loadingMessageIndex]} />
								</AnimatePresence>
							</div>
						</div>
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

			<footer className="relative z-10 py-4 text-center text-muted-foreground font-mono text-xs uppercase tracking-widest">
				Made for <img src="https://www.42network.org/wp-content/uploads/2024/04/42.svg" alt="42" className="inline-block w-6" /> Students
				<br />
				By <a href="https://profile.intra.42.fr/users/mhasoneh">Mhasoneh</a>
			</footer>
		</div>
	);
}

const LOADING_MESSAGES = [
	"Connecting to Intra 42...",
	"Downloading coffee logs...",
	"Analyzing segmentation faults...",
	"Calculating sleep debt...",
	"Counting norminette errors...",
	"Fetching project history...",
	"Compiling year data...",
	"Reviewing peer reviews...",
	"Searching for leaks...",
	"Reticulating splines...",
];

function LoadingText({ message }: { message: string }) {
	return (
		<motion.p
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -10 }}
			transition={{ duration: 0.3 }}
			className="text-primary font-bold text-lg uppercase tracking-wider whitespace-nowrap absolute"
		>
			{message}
		</motion.p>
	);
}
