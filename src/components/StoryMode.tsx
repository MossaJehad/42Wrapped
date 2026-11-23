
import { useState, useEffect, useCallback } from 'react';
import { cn } from '../lib/utils';
import { ChevronLeft, ChevronRight, Clock, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MusicPlayerWidget } from './MusicPlayerWidget';

interface StoryModeProps {
	user: any;
	achievements?: any[];
	locations?: any[];
	evaluations?: any[];
	teams?: any[];
	onClose?: () => void;
}

export function StoryMode({ user, achievements = [], locations = [], teams = [], evaluations = [], onClose }: StoryModeProps) {
	const [currentStep, setCurrentStep] = useState(0);
	const [isPaused, setIsPaused] = useState(false);
	const [showQuote, setShowQuote] = useState(false);
	const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);

	// Pre-fetch avatar as DataURL to avoid CORS issues during image generation
	useEffect(() => {
		const loadAvatar = async () => {
			if (user.image?.link) {
				try {
					const img = new Image();
					img.crossOrigin = 'anonymous';
					img.src = user.image.link;
					await new Promise((resolve, reject) => {
						img.onload = resolve;
						img.onerror = reject;
					});
					const canvas = document.createElement('canvas');
					canvas.width = img.width;
					canvas.height = img.height;
					const ctx = canvas.getContext('2d');
					ctx?.drawImage(img, 0, 0);
					setAvatarDataUrl(canvas.toDataURL('image/png'));
				} catch (e) {
					console.warn("Could not convert avatar to data URL (CORS)", e);
				}
			}
		};
		loadAvatar();
	}, [user.image?.link]);

	// Quotes Map
	const QUOTES: Record<number, string> = {
		1: "Talk is cheap. Show me the code.",
		2: "There is no traffic jam along the extra mile.",
		3: "Skill is only developed by hours and hours of work.",
		4: "Time is what we want most, but what we use worst.",
		5: "Consistency is the DNA of mastery.",
		6: "Greatness is a lot of small things done well.",
		7: "Alone we can do so little; together we can do so much.",
		8: "Patience is effective. Speed is impressive.",
		9: "Quality is not an act, it is a habit.",
		10: "Feedback is the breakfast of champions.",
		11: "You are what you do, not what you say you'll do.",
	};

	// --- Data Processing for Current Year ---
	const currentYear =
		Number((import.meta as any).env?.VITE_WRAPPED_YEAR) ||
		new Date().getFullYear();
	const totalSteps = 13;

	// Robust data extractor for TanStack RPC format
	const extractData = (data: any) => {
		if (!data) return [];
		if (Array.isArray(data)) return data;
		if (data.p && data.p.v && Array.isArray(data.p.v)) {
			const idx = data.p.k?.indexOf('result');
			if (idx !== -1 && data.p.v[idx]) {
				const res = data.p.v[idx];
				if (typeof res === 'object' && res !== null && 'a' in res && Array.isArray(res.a)) return res.a;
				return Array.isArray(res) ? res : [res];
			}
		}
		return [];
	};

	// 1. Projects
	const rawProjects = user.projects_users || [];
	const projects2025 = rawProjects.filter((p: any) => {
		if (!p.marked_at) return false;
		const d = new Date(p.marked_at);
		return d.getFullYear() === currentYear && p.status === 'finished' && p['validated?'];
	});

	const topProjects = [...projects2025].sort((a: any, b: any) => b.final_mark - a.final_mark);
	const bonusProjects = projects2025.filter((p: any) => p.final_mark > 100);
	const totalProjects = projects2025.length;
	const averageMark = totalProjects > 0
		? Math.round(projects2025.reduce((acc: number, curr: any) => acc + (curr.final_mark || 0), 0) / totalProjects)
		: 0;

	// 2. Skills
	const cursusUsers = user.cursus_users || [];
	// Prioritize "main" cursus (Core) or fallback to the one with highest level / most skills if main not found
	const activeCursus = cursusUsers.find((cu: any) => cu.cursus?.kind === 'main' || cu.cursus?.name === '42cursus')
		|| cursusUsers.find((cu: any) => cu.skills && cu.skills.length > 0)
		|| cursusUsers[0];
	const skills = activeCursus?.skills || [];

	const topSkills = [...skills].sort((a: any, b: any) => b.level - a.level).slice(0, 5);

	// 4. Log Time (Last 4 Months)
	const now = new Date();
	const fourMonthsAgo = new Date();
	fourMonthsAgo.setMonth(now.getMonth() - 4);

	// Helper to process intervals
	const dayIntervals = new Map<string, Array<{ start: number, end: number }>>();
	const rawLocations = extractData(locations);

	rawLocations.forEach((loc: any) => {
		let currentStr = loc.begin_at;
		let endStr = loc.end_at;
		if (!currentStr) return;

		let start = new Date(currentStr);
		let end = endStr ? new Date(endStr) : new Date();

		// Clip to 4 months ago
		if (end < fourMonthsAgo) return;
		if (start < fourMonthsAgo) start = fourMonthsAgo;
		if (start >= end) return;

		// Split across midnights
		while (start < end) {
			const dateKey = start.toDateString();

			// End of this day (23:59:59.999)
			const endOfDay = new Date(start);
			endOfDay.setHours(23, 59, 59, 999);

			// The explicit end of this segment is either the session end or end of day
			const segmentEnd = end < endOfDay ? end : endOfDay;

			// Add to map
			if (!dayIntervals.has(dateKey)) {
				dayIntervals.set(dateKey, []);
			}
			dayIntervals.get(dateKey)?.push({
				start: start.getTime(),
				end: segmentEnd.getTime()
			});

			// Next iteration starts at 00:00:00 of next day
			start = new Date(segmentEnd.getTime() + 1);
		}
	});

	// Process each day: Merge overlaps and sum duration
	let totalLogMinutes = 0;
	const dailyMinutes: number[] = [];

	dayIntervals.forEach((intervals) => {
		if (intervals.length === 0) return;

		// Sort by start time
		intervals.sort((a, b) => a.start - b.start);

		// Merge
		const merged = [];
		let current = intervals[0];

		for (let i = 1; i < intervals.length; i++) {
			const next = intervals[i];
			if (current.end >= next.start) {
				// Overlap or adjacent, merge
				current.end = Math.max(current.end, next.end);
			} else {
				// No overlap, push current and move to next
				merged.push(current);
				current = next;
			}
		}
		merged.push(current);

		// Sum
		let dayMinutes = 0;
		merged.forEach(interval => {
			const m = Math.floor((interval.end - interval.start) / 1000 / 60);
			dayMinutes += m;
		});

		dailyMinutes.push(dayMinutes);
		totalLogMinutes += dayMinutes;
	});

	// --- Weekly Activity Calculation ---
	const daysOfWeekLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const dayCounts = [0, 0, 0, 0, 0, 0, 0];

	dayIntervals.forEach((intervals, dateKey) => {
		const date = new Date(dateKey);
		const dayIndex = date.getDay();
		let minutes = 0;
		intervals.forEach(i => {
			minutes += (i.end - i.start) / 1000 / 60;
		});
		dayCounts[dayIndex] += minutes;
	});

	const maxWeeklyMinutes = Math.max(...dayCounts, 1);
	const peakDayIndex = dayCounts.indexOf(Math.max(...dayCounts));
	const peakDayFull = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][peakDayIndex];
	const peakDayShort = daysOfWeekLabels[peakDayIndex];


	const maxLogMinutes = dailyMinutes.length > 0 ? Math.max(...dailyMinutes) : 0;
	const avgLogMinutes = dailyMinutes.length > 0 ? Math.round(totalLogMinutes / dailyMinutes.length) : 0;

	// Formatting helpers
	const formatDuration = (mins: number) => {
		const h = Math.floor(mins / 60);
		const m = mins % 60;
		return `${h}h ${m}m`;
	};

	// 5. Feedback (Evaluations)
	// Assuming 'evaluations' contains scale_teams where user is the corrector or corrected
	// If we want "Average Feedback of the user", we usually look at ratings received.
	// 42 API structure: scale_teams has 'final_mark' (grade) and sometimes 'feedback' (text).
	// Stars usually come from 'feedback_rating' if available, or we might be looking at correctors' ratings.
	// For now, let's calculate average 'final_mark' received if available, or just guess based on likely data.
	// If the user wants the "Average Feedback" (stars 1-5), we need that specific field.
	// Fallback: If evaluations have 'feedback_rating' (user as corrector rating), use that.


	// 6. Group Projects
	const rawTeams = extractData(teams);
	const groupTeams = rawTeams.filter((t: any) => {
		// Check dates (created_at or updated_at in 2025)
		const copyDate = t.created_at || t.updated_at;
		if (!copyDate) return false;
		const d = new Date(copyDate);
		if (d.getFullYear() !== currentYear) return false;

		// Check size (if users list is populated or 'users_count' exists?)
		// API usually returns 'users' array in team object
		if (t.users && t.users.length > 1) return true;

		// Fallback if users array not fully populated but we assume "Team" endpoint implies potential groups?
		// Actually, solo projects also have "teams".
		// Best proxy for "Group Project" without full project config is > 1 user.
		return false;
	});

	// 3. Achievements
	const rawAchievements = extractData(achievements);
	const sourceAchievements = (rawAchievements && rawAchievements.length > 0) ? rawAchievements : (user.achievements || []);
	const ownedAchievementIds = new Set(user.achievements?.map((a: any) => a.id) || []);

	const achievementsFiltered = sourceAchievements.map((ach: any) => {
		// Try to resolve name if missing (common when fetching from achievements_users endpoint)
		let resolvedName = ach.name;
		if ((!resolvedName || resolvedName === 'Unknown') && user.achievements) {
			const found = user.achievements.find((ua: any) => ua.id === ach.id);
			if (found) resolvedName = found.name;
		}

		return {
			...ach,
			name: resolvedName,
			// If unlocked_at is missing (from user.achievements), treat as valid but undated
			dateObj: ach.unlocked_at ? new Date(ach.unlocked_at) : null
		};
	}).filter((ach: any) => {
		// Strict ownership check: Must be in user.achievements
		if (!ownedAchievementIds.has(ach.id) && user.achievements && user.achievements.length > 0) {
			return false;
		}

		// Check validity of date
		const isValidDate = ach.dateObj && !isNaN(ach.dateObj.getTime());

		// (Removed name filter so we show EVERYTHING for 2025)

		// If we have a valid date, filter by 2025.
		if (isValidDate) {
			return ach.dateObj.getFullYear() === currentYear;
		}
		// If no date or invalid date (fallback data), always include it
		return true;
	}).sort((a: any, b: any) => {
		const dateA = a.dateObj && !isNaN(a.dateObj.getTime()) ? a.dateObj : null;
		const dateB = b.dateObj && !isNaN(b.dateObj.getTime()) ? b.dateObj : null;

		// Sort by date if available
		if (dateA && dateB) {
			return dateA.getTime() - dateB.getTime();
		}
		// Fallback sort by ID (usually higher ID = newer)
		return a.id - b.id;
	});

	// Get the last 5 (most recent). slice(-5) takes the last 5 elements of the sorted array.
	const displayAchievements = achievementsFiltered.slice(-5);

	// --- NEW DATA LOGIC FOR WRAPPED EXTENSIONS ---
	const myId = user.id;
	const rawEvals = extractData(evaluations);

	// Filter 2025 evals
	const evals2025 = rawEvals.filter((e: any) => {
		const dateStr = e.filled_at || e.begin_at || e.created_at;
		if (!dateStr) return false;
		const d = new Date(dateStr);
		return d.getFullYear() === currentYear;
	});

	// 1. As Corrector (I evaluated others)
	const asCorrector = evals2025.filter((e: any) => e.is_corrector === true || Number(e.corrector?.id) === Number(myId));

	// 2. As Corrected (I was evaluated)
	const asCorrected = evals2025.filter((e: any) => e.is_corrector === false || e.correcteds?.some((u: any) => Number(u.id || u) === Number(myId)));

	// --- Time Wrapped Stats ---
	const evalDurations = asCorrector.map((e: any) => {
		const begin = e.begin_at || e.created_at || e.updated_at;
		const filled = e.filled_at || e.updated_at;
		if (!begin || !filled) return null;

		const start = new Date(begin).getTime();
		const end = new Date(filled).getTime();
		let diff = (end - start) / 1000 / 60; // minutes

		// If begin/end are swapped or same, use a default minimum of 15 mins for a valid eval
		if (diff <= 0) diff = 15;
		return diff;
	}).filter((d: any) => d !== null && d >= 0 && d < 600) as number[];

	const fastestEval = evalDurations.length ? Math.min(...evalDurations) : 0;
	const longestEval = evalDurations.length ? Math.max(...evalDurations) : 0;
	const avgEvalTime = evalDurations.length
		? Math.round(evalDurations.reduce((a, b) => a + Number(b), 0) / evalDurations.length)
		: 14; // default fallback if data missing (usually 15-20 mins)

	// --- Quality Check ---
	const outstandingCount = asCorrected.filter((e: any) => e.final_mark && e.final_mark >= 100).length;

	const correctFlags = asCorrected.map((e: any) => e.flag?.name).filter(Boolean);
	const totalWithFlags = correctFlags.length;
	// Assuming 'Leaks' is implied by specific flag names or lack of 'Ok' if failed?
	// Commonly 'Ok' is good. 'Leaks' is bad.
	const leakFlags = correctFlags.filter((f: string) => f.toLowerCase().includes('leak')).length;
	const leakFreeRate = totalWithFlags > 0
		? Math.round(((totalWithFlags - leakFlags) / totalWithFlags) * 100)
		: 100;

	const flagCounts: Record<string, number> = {};
	correctFlags.forEach((f: string) => flagCounts[f] = (flagCounts[f] || 0) + 1);
	const mostCommonFlag = Object.entries(flagCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Clean";

	const evaluators: Record<string, number> = {};
	asCorrected.forEach((e: any) => {
		if (e.corrector?.login) {
			evaluators[e.corrector.login] = (evaluators[e.corrector.login] || 0) + 1;
		}
	});
	const topEvaluators = Object.entries(evaluators)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 3)
		.map(([name, count]) => ({ name, count }));

	// Nicest feedback (5 stars + longest comment)
	const niceFeedbacks = asCorrector.map((e: any) => {
		const rating = e.feedback_rating ?? e.feedbacks?.[0]?.rating;
		const text = e.feedback ?? e.feedbacks?.[0]?.comment;
		return { ...e, feedback_rating: rating, feedback: text };
	}).filter((e: any) => Number(e.feedback_rating) === 5 && e.feedback && e.feedback.length > 5);

	const nicestFeedback = niceFeedbacks.sort((a: any, b: any) => (b.feedback?.length || 0) - (a.feedback?.length || 0))[0];

	// --- Personality Logic ---
	let personality = "The Explorer";
	let personalityDesc = "Exploring the 42 universe.";

	const marks = projects2025.map((p: any) => p.final_mark || 0);
	const mean = marks.length ? marks.reduce((a: any, b: any) => a + b, 0) / marks.length : 0;
	const variance = marks.length ? marks.reduce((a: any, b: any) => a + Math.pow(b - mean, 2), 0) / marks.length : 0;
	const stdDev = Math.sqrt(variance);

	// Priority Logic
	if (mean > 95 && stdDev < 15 && totalProjects >= 3) {
		personality = "The Consistent Builder";
		personalityDesc = "Reliable. Steady. Unbreakable code.";
	} else if (bonusProjects.length >= 3) {
		personality = "Bonus Hunter";
		personalityDesc = "Why settle for 100% when you can get 125%?";
	} else if (leakFreeRate === 100 && totalProjects >= 3) {
		personality = "Clean Code Monk";
		personalityDesc = "No leaks, just pure logic.";
	} else if (avgEvalTime < 15 && evalDurations.length > 10) {
		personality = "Evaluation Speedrunner";
		personalityDesc = "Any% Speedrun World Record holder.";
	} else if (totalLogMinutes > 60 * 200) { // arbitrary high number
		personality = "The Resident";
		personalityDesc = "Do you even pay rent at home anymore?";
	}

	// Navigation Handlers
	const nextStep = useCallback(() => {
		if (currentStep < totalSteps - 1) {
			setCurrentStep(prev => prev + 1);
		} else {
			onClose?.();
		}
	}, [currentStep, totalSteps, onClose]);

	const prevStep = useCallback(() => {
		if (currentStep > 0) {
			setCurrentStep(prev => prev - 1);
		}
	}, [currentStep]);

	// Touch/Swipe Handlers for Mobile
	const [touchStart, setTouchStart] = useState<number | null>(null);
	const [touchEnd, setTouchEnd] = useState<number | null>(null);

	const minSwipeDistance = 50;

	const onTouchStart = useCallback((e: React.TouchEvent) => {
		setTouchEnd(null);
		setTouchStart(e.targetTouches[0].clientX);
	}, []);

	const onTouchMove = useCallback((e: React.TouchEvent) => {
		setTouchEnd(e.targetTouches[0].clientX);
	}, []);

	const onTouchEnd = useCallback(() => {
		if (!touchStart || !touchEnd) return;

		const distance = touchStart - touchEnd;
		const isLeftSwipe = distance > minSwipeDistance;
		const isRightSwipe = distance < -minSwipeDistance;

		if (isLeftSwipe) {
			nextStep();
		} else if (isRightSwipe) {
			prevStep();
		}

		setTouchStart(null);
		setTouchEnd(null);
	}, [touchStart, touchEnd, nextStep, prevStep]);

	// Auto-advance logic
	useEffect(() => {
		if (isPaused) return;

		// If a quote exists for this step and we haven't shown it yet (?)
		// actually we handle the quote switch effect separately below.

		// If showing quote, we don't advance step yet.
		if (showQuote) return;

		const timer = setTimeout(() => {
			nextStep();
		}, 5000); // 5s for snappier feel

		return () => clearTimeout(timer);
	}, [currentStep, isPaused, nextStep, showQuote]);

	// Quote Timer Logic
	useEffect(() => {
		if (QUOTES[currentStep]) {
			setShowQuote(true);
			const timer = setTimeout(() => {
				setShowQuote(false);
			}, 1720); // 1.72s - very snappy
			return () => clearTimeout(timer);
		} else {
			setShowQuote(false);
		}
	}, [currentStep]);

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black animate-in fade-in zoom-in-95 duration-500 font-sans">
			{/* Navigation Buttons (Desktop) */}
			<button
				onClick={prevStep}
				disabled={currentStep === 0}
				className="hidden cursor-pointer md:flex absolute left-64 top-1/2 -translate-y-1/2 z-50 text-white/50 hover:text-white hover:bg-white/5 rounded-full transition disabled:opacity-0"
			>
				<ChevronLeft size={48} />
			</button>

			<button
				onClick={nextStep}
				disabled={currentStep === totalSteps - 1}
				className="hidden cursor-pointer md:flex absolute right-64 top-1/2 -translate-y-1/2 z-50 text-white/50 hover:text-white hover:bg-white/5 rounded-full transition disabled:opacity-0"
			>
				<ChevronRight size={48} />
			</button>

			{/* Mobile-first container */}
			<div
				className="relative w-full h-full md:w-[400px] md:h-[800px] md:rounded-2xl overflow-hidden bg-background shadow-2xl"
				onTouchStart={onTouchStart}
				onTouchMove={onTouchMove}
				onTouchEnd={onTouchEnd}
			>

				{/* Progress Bars */}
				<div className="absolute top-4 left-0 right-0 z-20 flex gap-1 px-2">
					{Array.from({ length: totalSteps }).map((_, idx) => (
						<div key={idx} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
							<div
								className={cn(
									"h-full bg-white transition-all duration-500 ease-linear",
									idx < currentStep ? "w-full" :
										(idx === currentStep && !showQuote) ? "animate-story-progress w-full" : "w-0"
								)}
								style={{
									animationDuration: '6s',
									animationPlayState: (idx === currentStep && !isPaused && !showQuote) ? 'running' : 'paused'
								}}
							/>
						</div>
					))}
				</div>

				{/* Tap Areas for Navigation - Lower Z but pointer-events enabled */}
				<div
					className="absolute inset-0 z-10 flex"
					onTouchStart={onTouchStart}
					onTouchMove={onTouchMove}
					onTouchEnd={onTouchEnd}
				>
					<div className="w-1/3 h-full cursor-pointer" onClick={prevStep} />
					<div className="w-2/3 h-full cursor-pointer" onClick={nextStep} />
				</div>

				{/* Play/Pause Button - Bottom Right */}
				<button
					onClick={(e) => {
						e.stopPropagation();
						setIsPaused(!isPaused);
					}}
					className="absolute border border-white/8 bottom-6 right-6 z-50 p-3 bg-white/10 cursor-pointer hover:bg-white/20 backdrop-blur-md rounded-2xl text-white transition-all duration-500 ring-1 ring-white/10 group shadow-lg"
					title={isPaused ? "Play" : "Pause"}
				>
					{isPaused ? (
						<svg fill="currentColor" viewBox="0 0 24 24" width="24" height="24">
							<path d="M8 5v14l11-7z" />
						</svg>
					) : (
						<svg fill="currentColor" viewBox="0 0 24 24" width="24" height="24">
							<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
						</svg>
					)}
				</button>

				{/* Quote Overlay */}
				<AnimatePresence>
					{showQuote && (
						<motion.div
							key="quote-overlay"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.5 }}
							className="absolute inset-0 z-50 flex items-center justify-center p-8 text-center bg-black/60"
						>
							<motion.p
								initial={{ opacity: 0, y: 40 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 1.2, ease: "easeOut" }}
								className="text-3xl md:text-4xl font-black text-white leading-tight tracking-tight drop-shadow-2xl max-w-sm"
							>
								"{QUOTES[currentStep]}"
							</motion.p>
						</motion.div>
					)}
				</AnimatePresence>

				{/* Story Content - Higher Z but passes through unless interactive */}
				<div className="w-full h-full relative z-20 pointer-events-none">


					{/* Slide 1: User Profile */}
					{currentStep === 0 && (
						<div className="w-full h-full bg-[#7000FF] text-white flex flex-col items-center justify-center p-8 animate-in fade-in duration-500 relative overflow-hidden pointer-events-auto">
							{/* Background Sunburst Effect */}
							<div className="absolute inset-0 flex items-center justify-center z-0 opacity-20">
								<div className="min-w-[1200px] min-h-[1200px] bg-[conic-gradient(from_0deg_at_50%_50%,_transparent_0deg,_#000_20deg,_transparent_40deg,_#000_60deg,_transparent_80deg,_#000_100deg,_transparent_120deg,_#000_140deg,_transparent_160deg,_#000_180deg,_transparent_200deg,_#000_220deg,_transparent_240deg,_#000_260deg,_transparent_280deg,_#000_300deg,_transparent_320deg,_#000_340deg,_transparent_360deg)] animate-[spin_20s_linear_infinite]" />
							</div>

							<div className="relative z-10 flex flex-col items-center">
								<div className="relative mb-8 group">
									<div className="" />
									<div className="relative w-40 h-40 rounded-full border-4 border-black overflow-hidden bg-black shadow-2xl transform transition group-hover:scale-105">
										{avatarDataUrl || user.image?.link ? (
											<img
												src={avatarDataUrl || user.image.link}
												alt={user.login}
												className="w-full h-full object-cover"
												crossOrigin="anonymous"
											/>
										) : (
											<div className="w-full h-full bg-gray-900 flex items-center justify-center text-5xl font-black">
												{user.login?.[0]?.toUpperCase()}
											</div>
										)}
									</div>
									<div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-black text-white font-black px-4 py-1.5 rounded-full text-sm uppercase tracking-widest border-2 border-yellow-400 whitespace-nowrap z-20">
										Main Character
									</div>
								</div>

								<div className="space-y-2 text-center">
									<h2 className="text-5xl md:text-6xl font-black text-white leading-[0.85] tracking-tighter drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] animate-in slide-in-from-bottom-8 fade-in duration-1000 delay-300 fill-mode-forwards">
										{user.displayname?.split(' ').map((n: string, i: number) => (
											<span key={i} className="block">{n}</span>
										)) || user.login}
									</h2>
									<p className="text-xl font-bold font-mono bg-black/20 inline-block px-3 py-1 rounded animate-in slide-in-from-bottom-8 fade-in duration-1000 delay-500 fill-mode-forwards">
										@{user.login}
									</p>
								</div>

								<div className="mt-12 bg-white text-black p-6 rounded-3xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,0.3)] w-full rotate-2 transform transition hover:rotate-0 hover:scale-105">
									<p className="text-center font-black text-lg uppercase leading-tight">
										Your {currentYear} Wrapped is served.
									</p>
								</div>
							</div>
						</div>
					)}

					{/* Slide 2: Achievements - "Top List" Style -> Now Step 6 */}
					{currentStep === 6 && (
						<div className="w-full h-full bg-[#FF4500] text-white flex flex-col relative overflow-hidden p-6 font-sans pointer-events-auto">
							{/* Zig Zag Pattern - Always visible */}
							<div className="absolute inset-0 z-0 opacity-10"
								style={{
									backgroundImage: 'linear-gradient(135deg, #000 25%, transparent 25%), linear-gradient(225deg, #000 25%, transparent 25%), linear-gradient(45deg, #000 25%, transparent 25%), linear-gradient(315deg, #000 25%, transparent 25%)',
									backgroundPosition: '10px 0, 10px 0, 0 0, 0 0',
									backgroundSize: '20px 20px',
									backgroundRepeat: 'repeat'
								}}
							/>

							{/* Large background decorative Achievement Icon - Always visible */}
							<svg className="absolute -right-20 top-20 w-96 h-96 opacity-10 rotate-12" viewBox="0 0 24 24" fill="currentColor">
								<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
							</svg>

							<AnimatePresence>
								{!showQuote && (
									<motion.div
										className="relative my-20 z-10 w-full h-full flex flex-col"
										initial={{ opacity: 0, x: -30 }}
										animate={{ opacity: 1, x: 0 }}
										transition={{ duration: 0.6, ease: "easeOut" }}
									>
										{/* Title */}
										<motion.div
											className="mt-12 mb-8"
											initial={{ opacity: 0, y: -20 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ duration: 0.5, delay: 0.1 }}
										>
											<h2 className="text-6xl font-black tracking-tighter uppercase leading-[0.8] mb-4">
												Level<br />
												<span className="text-black inline-block transform -skew-x-12 bg-white px-2">UP!</span>
											</h2>
										</motion.div>

										{/* The List 1-5 */}
										<div className="flex flex-col gap-3 w-full flex-1 overflow-y-auto no-scrollbar">
											{displayAchievements.map((ach: any, idx: number) => (
												<motion.div
													key={ach.id}
													className="flex items-center gap-4 group"
													initial={{ opacity: 0, x: -20 }}
													animate={{ opacity: 1, x: 0 }}
													transition={{ duration: 0.4, delay: 0.2 + idx * 0.1 }}
												>
													{/* Number */}
													<div className="w-10 h-10 flex-shrink-0 bg-black text-[#FF4500] font-black text-2xl flex items-center justify-center rounded-lg shadow-lg border-2 border-white transform group-hover:rotate-12 transition-transform">
														{idx + 1}
													</div>

													{/* Name Box */}
													<div className="flex-1 bg-white/90 backdrop-blur-sm text-black font-bold text-sm md:text-base px-4 py-3 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform transition hover:translate-x-1 hover:-translate-y-1">
														<span className="line-clamp-2 leading-tight">
															{ach.name}
														</span>
													</div>
												</motion.div>
											))}

											{displayAchievements.length === 0 && (
												<motion.div
													className="flex-1 flex items-center justify-center"
													initial={{ opacity: 0 }}
													animate={{ opacity: 1 }}
													transition={{ duration: 0.5, delay: 0.3 }}
												>
													<div className="bg-black/20 p-6 rounded-2xl text-center border-2 border-dashed border-white/50">
														<p className="font-bold text-xl uppercase">No unlocks yet</p>
													</div>
												</motion.div>
											)}
										</div>

										{/* Count Summary */}
										<motion.div
											className="mt-6 pt-6 border-t-4 border-black/10"
											initial={{ opacity: 0, y: 20 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ duration: 0.5, delay: 0.8 }}
										>
											<div className="flex justify-between items-end">
												<div className="font-black text-sm uppercase max-w-[100px] leading-tight opacity-80">
													Total Unlocked in {currentYear}
												</div>
												<div className="text-8xl font-black leading-none tracking-tighter drop-shadow-lg">
													{achievementsFiltered.length}
												</div>
											</div>
										</motion.div>
									</motion.div>
								)}
							</AnimatePresence>
						</div>
					)}

					{/* Slide 3: Projects 2025 Card -> Now Step 1 */}
					{currentStep === 1 && (
						<div className="w-full h-full bg-[#00E5FF] text-black flex flex-col items-center p-6 relative overflow-hidden pointer-events-auto">
							{/* Background Grid - Always visible */}
							<div className="absolute inset-0 z-0 opacity-20"
								style={{
									backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
									backgroundSize: '40px 40px'
								}}
							/>

							{/* Floating Elements - Always visible */}
							<div className="absolute top-10 right-10 text-6xl font-mono font-black opacity-10 rotate-12">{`</>`}</div>
							<div className="absolute bottom-20 left-10 text-8xl font-mono font-black opacity-10 -rotate-12">{`{ }`}</div>

							{/* Content - Only shows after quote vanishes */}
							<AnimatePresence>
								{!showQuote && (
									<motion.div
										className="relative my-6 sm:my-10 z-10 w-full h-full flex flex-col"
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ duration: 0.6, ease: "easeOut" }}
									>
										<motion.h2
											className="text-6xl font-black tracking-tighter mb-8 text-left mt-4 sm:mt-10"
											initial={{ opacity: 0, x: -30 }}
											animate={{ opacity: 1, x: 0 }}
											transition={{ duration: 0.5, delay: 0.1 }}
										>
											CODE
											<br />
											<span className="text-white bg-black px-2 py-0">MODE</span>
										</motion.h2>

										<motion.div
											className="grid grid-cols-2 gap-4 mb-6"
											initial={{ opacity: 0 }}
											animate={{ opacity: 1 }}
											transition={{ duration: 0.4, delay: 0.2 }}
										>
											<motion.div
												className="bg-[#2d3436] text-[#00E5FF] p-4 rounded-tl-3xl rounded-br-3xl rounded-tr-lg rounded-bl-lg border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between aspect-[4/3]"
												initial={{ opacity: 0, scale: 0.8 }}
												animate={{ opacity: 1, scale: 1 }}
												transition={{ duration: 0.4, delay: 0.3 }}
											>
												<div className="text-5xl font-black">{totalProjects}</div>
												<div className="text-xs uppercase font-bold tracking-widest text-white">
													Projects
												</div>
											</motion.div>
											<motion.div
												className="bg-white text-black p-4 rounded-tr-3xl rounded-bl-3xl rounded-tl-lg rounded-br-lg border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between aspect-[4/3]"
												initial={{ opacity: 0, scale: 0.8 }}
												animate={{ opacity: 1, scale: 1 }}
												transition={{ duration: 0.4, delay: 0.4 }}
											>
												<div className="text-5xl font-black">{averageMark}%</div>
												<div className="text-xs uppercase font-bold tracking-widest opacity-60">
													Avg Score
												</div>
											</motion.div>
										</motion.div>

										<motion.div
											className="flex-1 bg-black text-white p-6 rounded-3xl border-4 border-white/20 overflow-hidden relative"
											initial={{ opacity: 0, y: 30 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ duration: 0.5, delay: 0.5 }}
										>
											<div className="absolute top-0 right-0 p-4 opacity-20 font-mono text-xs">
												top_projects.json
											</div>
											<p className="font-bold text-sm uppercase tracking-widest text-[#00E5FF] mb-4">
												Top Highlights
											</p>
											<div className="space-y-4">
												{topProjects.slice(0, 5).map((p: any, idx: number) => (
													<motion.div
														key={p.id}
														className="flex items-center justify-between border-b border-white/10 pb-2 last:border-0"
														initial={{ opacity: 0, x: -20 }}
														animate={{ opacity: 1, x: 0 }}
														transition={{ duration: 0.3, delay: 0.6 + idx * 0.1 }}
													>
														<span className="font-bold text-lg truncate w-2/3">{p.project.name}</span>
														<span className={`font-black text-xl ${p.final_mark >= 100 ? 'text-[#00E5FF]' : 'text-white'}`}>
															{p.final_mark}
														</span>
													</motion.div>
												))}
											</div>

											{topProjects.length === 0 && (
												<div className="h-full flex items-center justify-center opacity-50 font-mono">
													// No data found
												</div>
											)}
										</motion.div>
									</motion.div>
								)}
							</AnimatePresence>
						</div>
					)}

					{/* Step 3: Skills Stack */}
					{currentStep === 3 && (
						<div className="w-full h-full bg-[#E056FD] text-white flex flex-col items-center p-8 relative overflow-hidden pointer-events-auto">
							{/* Pattern BG: Polka Dots */}
							<div className="absolute inset-0 opacity-20 pointer-events-none"
								style={{
									backgroundImage: 'radial-gradient(circle, #000 2px, transparent 2.5px)',
									backgroundSize: '24px 24px'
								}}
							/>

							<AnimatePresence mode="wait">
								{!showQuote && (
									<motion.div
										className="relative z-10 w-full h-full flex flex-col justify-center"
										initial={{ opacity: 0, x: 30 }}
										animate={{ opacity: 1, x: 0 }}
										transition={{ duration: 0.5, ease: "easeOut" }}
									>
										<motion.h2
											className="text-5xl font-black tracking-tighter mb-8 text-right"
											initial={{ opacity: 0, y: -20 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ duration: 0.4, delay: 0.1 }}
										>
											SKILL
											<br />
											<span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-white text-6xl drop-shadow-sm">STACK</span>
										</motion.h2>

										<div className="w-full space-y-4">
											{topSkills.map((skill: any, index: number) => (
												<motion.div
													key={skill.id}
													className="w-full relative group"
													initial={{ opacity: 0, x: 20 }}
													animate={{ opacity: 1, x: 0 }}
													transition={{ duration: 0.4, delay: 0.2 + index * 0.05 }}
												>
													<div className="flex justify-between mb-1 text-lg font-black uppercase tracking-tight">
														<span>{skill.name}</span>
														<span className="text-yellow-300">{skill.level.toFixed(2)}</span>
													</div>
													<div className="h-4 w-full bg-black/30 rounded-full overflow-hidden border border-white/10">
														<motion.div
															className="h-full bg-gradient-to-r from-yellow-300 via-white to-yellow-300"
															initial={{ width: 0 }}
															animate={{ width: `${Math.min((skill.level / 10) * 100, 100)}%` }}
															transition={{ duration: 0.8, delay: 0.4 + index * 0.05 }}
														/>
													</div>
												</motion.div>
											))}
										</div>
									</motion.div>
								)}
							</AnimatePresence>
						</div>
					)}

					{/* Step 4: Log Time Stats */}
					{currentStep === 4 && (
						<div className="w-full h-full bg-[#2C3E50] text-white flex flex-col items-center p-6 relative overflow-hidden pointer-events-auto">
							{/* Background - Always visible */}
							<div className="absolute inset-0 opacity-10 pointer-events-none">
								<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border-[2px] border-white rounded-full animate-[spin_60s_linear_infinite]" />
								<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border-[2px] border-white rounded-full animate-[spin_40s_linear_infinite_reverse]" />
							</div>

							{/* Content - Only shows after quote vanishes */}
							<AnimatePresence>
								{!showQuote && (
									<motion.div
										className="relative z-10 w-full h-full flex flex-col justify-center"
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ duration: 0.6, ease: "easeOut" }}
									>
										<motion.div
											className="flex items-center gap-3 mb-8"
											initial={{ opacity: 0, x: -20 }}
											animate={{ opacity: 1, x: 0 }}
											transition={{ duration: 0.5, delay: 0.1 }}
										>
											<Clock size={40} className="text-[#3498DB]" />
											<h2 className="text-4xl font-black uppercase tracking-tighter">
												Time<br />Machine
											</h2>
										</motion.div>

										<motion.p
											className="font-mono font-bold text-sm uppercase opacity-88 mb-8 border-b border-white/20 pb-2"
											initial={{ opacity: 0 }}
											animate={{ opacity: 1 }}
											transition={{ duration: 0.5, delay: 0.2 }}
										>
											Last <span className="bg-white text-[#000] px-1.5 rounded mx-1 text-base font-black border-2 border-[#3498DB] shadow-[2px_2px_0px_#3498DB] transform -rotate-6 inline-block">4</span> Months Activity
										</motion.p>

										<div className="space-y-6 w-full max-w-xs mx-auto">
											<motion.div
												className="bg-black/20 p-5 rounded-2xl border border-white/10 backdrop-blur-sm"
												initial={{ opacity: 0, scale: 0.9 }}
												animate={{ opacity: 1, scale: 1 }}
												transition={{ duration: 0.4, delay: 0.3 }}
											>
												<div className="text-3xl font-black text-[#3498DB]">
													{formatDuration(maxLogMinutes)}
												</div>
												<div className="text-xs uppercase font-bold opacity-60 mt-1">
													Longest Day
												</div>
											</motion.div>

											<motion.div
												className="bg-black/20 p-5 rounded-2xl border border-white/10 backdrop-blur-sm"
												initial={{ opacity: 0, scale: 0.9 }}
												animate={{ opacity: 1, scale: 1 }}
												transition={{ duration: 0.4, delay: 0.45 }}
											>
												<div className="text-3xl font-black text-white">
													{formatDuration(avgLogMinutes)}
												</div>
												<div className="text-xs uppercase font-bold opacity-60 mt-1">
													Daily Average
												</div>
											</motion.div>

											<motion.div
												className="bg-white/10 p-5 rounded-2xl border border-white/10 backdrop-blur-sm"
												initial={{ opacity: 0, scale: 0.9 }}
												animate={{ opacity: 1, scale: 1 }}
												transition={{ duration: 0.4, delay: 0.6 }}
											>
												<div className="text-3xl font-black text-[#FFD700]">
													{formatDuration(totalLogMinutes)}
												</div>
												<div className="text-xs uppercase font-bold opacity-60 mt-1">
													Total Tracked
												</div>
											</motion.div>
										</div>
									</motion.div>
								)}
							</AnimatePresence>
						</div>
					)}

					{/* Step 5: The Rhythm (Weekly Activity) */}
					{currentStep === 5 && (
						<div className="w-full h-full bg-[#8E44AD] text-white flex flex-col items-center p-4 sm:p-6 relative overflow-hidden pointer-events-auto">
							{/* Background - Always visible */}
							<div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

							<AnimatePresence>
								{!showQuote && (
									<motion.div
										className="relative my-6 sm:my-12 z-10 w-full h-full flex flex-col justify-center"
										initial={{ opacity: 0, y: 30 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ duration: 0.6, ease: "easeOut" }}
									>
										<motion.div
											className="mb-4 flex flex-col items-center text-center"
											initial={{ opacity: 0, scale: 0.9 }}
											animate={{ opacity: 1, scale: 1 }}
											transition={{ duration: 0.5, delay: 0.1 }}
										>
											<h2 className="text-5xl font-black uppercase tracking-tighter leading-none mb-2">
												The<br /><span className="text-[#F1C40F]">Rhythm</span>
											</h2>
											<p className="font-mono text-xs opacity-70 uppercase tracking-widest pl-1">
												Your Weekly Flow
											</p>
										</motion.div>


										<div className="w-full flex-1 flex flex-col items-center justify-between py-4">
											{/* Peak Day Display */}
											<motion.div
												className="flex-1 flex flex-col justify-center items-center text-center gap-6 w-full"
												initial={{ opacity: 0, scale: 0.8 }}
												animate={{ opacity: 1, scale: 1 }}
												transition={{ duration: 0.5, delay: 0.3 }}
											>
												<div className="transform transition hover:scale-105 duration-500">
													<div className="text-sm font-bold opacity-80 uppercase tracking-widest mb-2">
														Most Productive Day
													</div>
													<div className="text-6xl md:text-7xl font-black text-[#F1C40F] drop-shadow-[6px_6px_0px_rgba(0,0,0,0.3)]">
														{peakDayFull}
													</div>
												</div>

												<motion.p
													className="max-w-[280px] text-lg font-medium leading-relaxed opacity-90 bg-black/10 p-4 rounded-xl backdrop-blur-sm border border-white/10"
													initial={{ opacity: 0 }}
													animate={{ opacity: 1 }}
													transition={{ duration: 0.5, delay: 0.5 }}
												>
													Whatever coffee you were drinking, keep buying it.
												</motion.p>
											</motion.div>

											{/* Bar Chart */}
											<div className="w-full h-40 flex items-end justify-between gap-2 my-10">
												{dayCounts.map((minutes, idx) => {
													const heightPercent = Math.max((minutes / maxWeeklyMinutes) * 100, 10);
													const isPeak = idx === peakDayIndex;

													return (
														<div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
															<div className="w-full relative flex items-end justify-center h-full">
																<motion.div
																	className={`w-full rounded-t-lg transition-all duration-1000 ease-out ${isPeak ? 'bg-[#F1C40F] shadow-[0_0_15px_rgba(241,196,15,0.6)]' : 'bg-white/30 group-hover:bg-white/50'}`}
																	initial={{ height: 0 }}
																	animate={{ height: `${heightPercent}%` }}
																	transition={{ duration: 1, delay: 0.7 + idx * 0.1 }}
																/>
																<div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] font-bold px-2 py-1 rounded whitespace-nowrap pointer-events-none transition-opacity z-20">
																	{Math.round(minutes / 60)}h
																</div>
															</div>
															<motion.div
																className={`text-xs font-black uppercase tracking-tighter ${isPeak ? 'text-[#F1C40F]' : 'text-white/50'}`}
																initial={{ opacity: 0 }}
																animate={{ opacity: 1 }}
																transition={{ duration: 0.3, delay: 1 + idx * 0.1 }}
															>
																{daysOfWeekLabels[idx]}
															</motion.div>
														</div>
													);
												})}
											</div>
										</div>
									</motion.div>
								)}
							</AnimatePresence>
						</div>
					)}

					{/* Step 6: Group Projects -> Now Step 7 */}
					{currentStep === 7 && (
						<div className="w-full h-full bg-[#E74C3C] text-white flex flex-col items-center p-4 sm:p-6 relative overflow-hidden pointer-events-auto">
							{/* Background - Always visible */}
							<div className="absolute inset-0 opacity-20 pointer-events-none">
								<Users size={400} className="absolute -bottom-20 -right-20 rotate-12 opacity-30" />
							</div>

							<AnimatePresence>
								{!showQuote && (
									<motion.div
										className="relative my-6 sm:my-10 z-10 w-full h-full flex flex-col"
										initial={{ opacity: 0, x: -30 }}
										animate={{ opacity: 1, x: 0 }}
										transition={{ duration: 0.6, ease: "easeOut" }}
									>
										<motion.h2
											className="text-5xl font-black uppercase tracking-tighter text-left leading-[0.85] mb-4"
											initial={{ opacity: 0, scale: 0.9 }}
											animate={{ opacity: 1, scale: 1 }}
											transition={{ duration: 0.5, delay: 0.1 }}
										>
											Dream<br /><span className="text-black bg-white px-2">Team</span>
										</motion.h2>

										<div className="flex-1 overflow-y-auto w-full no-scrollbar space-y-4 pb-4">
											{groupTeams.length > 0 ? (
												groupTeams.map((team: any, idx: number) => (
													<motion.div
														key={team.id}
														className="bg-black/20 p-3 rounded-xl border-l-4 border-white backdrop-blur-sm hover:bg-black/30 transition-colors"
														initial={{ opacity: 0, y: 20 }}
														animate={{ opacity: 1, y: 0 }}
														transition={{ duration: 0.4, delay: 0.2 + idx * 0.1 }}
													>
														<div className="font-bold text-xl mb-1">
															{team.name || `Team #${team.id}`}
														</div>
														<div className="flex -space-x-2 overflow-hidden">
															{team.users?.map((u: any, uIdx: number) => (
																<motion.div
																	key={u.id}
																	className="inline-block h-8 w-8 rounded-full ring-2 ring-[#E74C3C] bg-gray-800 flex items-center justify-center text-xs font-bold overflow-hidden"
																	title={u.login}
																	initial={{ scale: 0 }}
																	animate={{ scale: 1 }}
																	transition={{ duration: 0.3, delay: 0.4 + idx * 0.1 + uIdx * 0.05 }}
																>
																	{u.image?.versions?.small || u.image?.link ? (
																		<img
																			src={u.image.versions?.small || u.image.link}
																			alt={u.login}
																			className="w-full h-full object-cover"
																			crossOrigin="anonymous"
																		/>
																	) : (
																		u.login?.[0]?.toUpperCase()
																	)}
																</motion.div>
															))}
														</div>
														<div className="items-center mt-2 text-xs font-mono opacity-70 flex gap-2">
															<Users size={12} />
															{team.users?.length || 0} Members
														</div>
													</motion.div>
												))
											) : (
												<motion.div
													className="h-40 flex items-center justify-center bg-white/10 rounded-2xl border-2 border-dashed border-white/30"
													initial={{ opacity: 0 }}
													animate={{ opacity: 1 }}
													transition={{ duration: 0.5, delay: 0.3 }}
												>
													<div className="text-center opacity-70">
														<p className="font-bold">No group projects</p>
														<p className="text-xs">in {currentYear}</p>
													</div>
												</motion.div>
											)}
										</div>

										<motion.div
											className="pt-4 border-t border-white/20 text-center"
											initial={{ opacity: 0, y: 20 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ duration: 0.5, delay: 0.8 }}
										>
											<div className="text-4xl font-black">{groupTeams.length}</div>
											<div className="text-xs uppercase font-bold tracking-widest opacity-70">Co-op Missions</div>
										</motion.div>
									</motion.div>
								)}
							</AnimatePresence>
						</div>
					)}

					{/* Step 7: Bonus Projects (Over Achiever) - was previously Step 4 -> Now Step 2 */}
					{currentStep === 2 && (
						<div className="w-full h-full bg-[#FFD700] text-black flex flex-col items-center p-8 relative overflow-hidden pointer-events-auto">
							{/* Trippy Geometric BG - Always visible */}
							<div className="absolute inset-0 z-0 opacity-20">
								{Array.from({ length: 12 }).map((_, i) => (
									<div
										key={i}
										className="absolute border-2 border-black rounded-full"
										style={{
											width: `${(i + 1) * 60}px`,
											height: `${(i + 1) * 60}px`,
											top: '50%',
											left: '50%',
											transform: `translate(-50%, -50%) rotate(${i * 15}deg)`,
										}}
									/>
								))}
							</div>

							<AnimatePresence>
								{!showQuote && (
									<motion.div
										className="relative z-10 w-full flex-1 flex flex-col justify-center"
										initial={{ opacity: 0, scale: 0.9 }}
										animate={{ opacity: 1, scale: 1 }}
										transition={{ duration: 0.6, ease: "easeOut" }}
									>
										<motion.h2
											className="text-6xl font-black tracking-tighter mb-2 text-center leading-[0.8]"
											initial={{ opacity: 0, y: -20 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ duration: 0.5, delay: 0.1 }}
										>
											OVER
											<br />
											<span className="text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]">ACHIEVER</span>
										</motion.h2>
										<motion.p
											className="text-center font-bold uppercase tracking-widest opacity-80 mb-10"
											initial={{ opacity: 0 }}
											animate={{ opacity: 1 }}
											transition={{ duration: 0.5, delay: 0.2 }}
										>
											Going above & beyond
										</motion.p>

										<div className="space-y-4 w-full">
											{bonusProjects.length > 0 ? (
												bonusProjects.map((p: any, idx: number) => (
													<motion.div
														key={p.id}
														className="relative bg-black text-[#FFD700] p-4 rounded-xl border-2 border-black transform transition hover:scale-105 hover:-rotate-1"
														initial={{ opacity: 0, x: -30 }}
														animate={{ opacity: 1, x: 0 }}
														transition={{ duration: 0.4, delay: 0.3 + idx * 0.1 }}
													>
														<div className="flex justify-between items-baseline">
															<span className="text-lg font-black truncate w-2/3">{p.project.name}</span>
															<span className="text-3xl font-black">{p.final_mark}%</span>
														</div>
														<div className="absolute -top-2 -right-2 bg-white text-black text-[10px] font-bold px-2 py-0.5 rounded-full border border-black">
															BONUS
														</div>
													</motion.div>
												))
											) : (
												<motion.div
													className="bg-black/10 p-6 rounded-2xl text-center border-2 border-black/10"
													initial={{ opacity: 0 }}
													animate={{ opacity: 1 }}
													transition={{ duration: 0.5, delay: 0.3 }}
												>
													<p className="font-bold">No bonus projects yet.</p>
													<p className="text-sm opacity-70">Push harder next year!</p>
												</motion.div>
											)}
										</div>

										{bonusProjects.length > 0 && (
											<motion.div
												className="mt-8 text-center font-bold uppercase text-xs tracking-widest bg-black text-white py-1 px-3 rounded-full self-center"
												initial={{ opacity: 0, y: 20 }}
												animate={{ opacity: 1, y: 0 }}
												transition={{ duration: 0.5, delay: 0.7 }}
											>
												{bonusProjects.length} Projects &gt; 100%
											</motion.div>
										)}
									</motion.div>
								)}
							</AnimatePresence>
						</div>
					)}




					{/* Step 8: Time Wrapped (Evaluations Duration) */}
					{currentStep === 8 && (
						<div className="w-full h-full bg-[#34495E] text-white flex flex-col items-center p-6 relative overflow-hidden pointer-events-auto">
							{/* Background - Always visible */}
							<div className="absolute inset-0 opacity-10 pointer-events-none">
								<Clock size={400} className="absolute -left-20 -bottom-20 rotate-12" />
							</div>

							<AnimatePresence>
								{!showQuote && (
									<motion.div
										className="relative z-10 w-full h-full flex flex-col justify-center"
										initial={{ opacity: 0, scale: 0.95 }}
										animate={{ opacity: 1, scale: 1 }}
										transition={{ duration: 0.4 }}
									>
										<motion.h2
											className="text-5xl font-black uppercase tracking-tighter mb-8 text-right leading-none"
											initial={{ opacity: 0, x: 20 }}
											animate={{ opacity: 1, x: 0 }}
											transition={{ duration: 0.4, delay: 0.05 }}
										>
											Time<br />
											<span className="text-[#3498DB]">Wrapped</span>
										</motion.h2>

										<div className="space-y-4">
											<motion.div
												className="bg-white/10 p-4 rounded-xl backdrop-blur-md border-l-4 border-[#3498DB]"
												initial={{ opacity: 0, x: 20 }}
												animate={{ opacity: 1, x: 0 }}
												transition={{ duration: 0.3, delay: 0.1 }}
											>
												<p className="text-xs font-bold uppercase opacity-60 mb-1">Fastest Eval</p>
												<div className="text-3xl font-black">{fastestEval.toFixed(0)} min</div>
												<p className="text-[10px] opacity-60 italic">Speedy gonzales!</p>
											</motion.div>

											<motion.div
												className="bg-white/10 p-4 rounded-xl backdrop-blur-md border-l-4 border-[#E74C3C]"
												initial={{ opacity: 0, x: 20 }}
												animate={{ opacity: 1, x: 0 }}
												transition={{ duration: 0.3, delay: 0.2 }}
											>
												<p className="text-xs font-bold uppercase opacity-60 mb-1">Longest Eval</p>
												<div className="text-3xl font-black">{longestEval.toFixed(0)} min</div>
												<p className="text-[10px] opacity-60 italic">We don't talk about it...</p>
											</motion.div>

											<motion.div
												className="bg-white/10 p-4 rounded-xl backdrop-blur-md border-l-4 border-[#2ECC71]"
												initial={{ opacity: 0, x: 20 }}
												animate={{ opacity: 1, x: 0 }}
												transition={{ duration: 0.3, delay: 0.3 }}
											>
												<p className="text-xs font-bold uppercase opacity-60 mb-1">Avg Duration</p>
												<div className="text-3xl font-black">{avgEvalTime} min</div>
											</motion.div>
										</div>
									</motion.div>
								)}
							</AnimatePresence>
						</div>
					)}

					{/* Step 9: Quality Check */}
					{currentStep === 9 && (
						<div className="w-full h-full bg-[#16213E] text-white flex flex-col items-center p-6 relative overflow-hidden pointer-events-auto">
							{/* Fancy Background - Always visible */}
							<div className="absolute inset-0 bg-gradient-to-br from-[#1A1A2E] via-[#16213E] to-[#0F3460] z-0" />
							<div className="absolute top-0 right-0 w-full h-full opacity-20"
								style={{
									backgroundImage: 'radial-gradient(circle at 70% 20%, rgba(76, 201, 240, 0.4) 0%, transparent 40%)'
								}}
							/>

							{/* Floating Particles - Always visible */}
							<div className="absolute top-10 left-10 w-4 h-4 bg-[#4CC9F0] rounded-full animate-bounce duration-[3s]" />
							<div className="absolute bottom-20 right-10 w-6 h-6 bg-[#4361EE] rounded-full animate-bounce duration-[5s] delay-700" />

							<AnimatePresence>
								{!showQuote && (
									<motion.div
										className="relative z-10 w-full h-full flex flex-col justify-center"
										initial={{ opacity: 0, scale: 0.8 }}
										animate={{ opacity: 1, scale: 1 }}
										transition={{ duration: 0.6, ease: "backOut" }}
									>
										<motion.h2
											className="text-5xl font-black uppercase tracking-tighter mb-10 text-center relative max-w-xs mx-auto"
											initial={{ opacity: 0, y: -20 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ duration: 0.5, delay: 0.1 }}
										>
											<span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-[#4CC9F0] to-[#4361EE] drop-shadow-sm">
												Quality<br />Control
											</span>
											<div className="absolute -inset-4 bg-white/5 blur-xl rounded-full z-0" />
										</motion.h2>

										<div className="grid grid-cols-1 gap-6 w-full max-w-xs mx-auto">
											<motion.div
												className="group bg-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/10 hover:bg-white/10 transition-all duration-300 hover:scale-105 border-l-4 border-l-[#4CC9F0]"
												initial={{ opacity: 0, scale: 0.9 }}
												animate={{ opacity: 1, scale: 1 }}
												transition={{ duration: 0.4, delay: 0.3 }}
											>
												<div className="text-6xl font-black mb-2 bg-clip-text text-transparent bg-gradient-to-br from-white to-gray-400 group-hover:scale-110 transition-transform origin-left">
													{outstandingCount}
												</div>
												<div className="text-sm font-bold uppercase tracking-widest text-[#4CC9F0] opacity-80 animate-pulse">
													Outstanding
												</div>
												<div className="text-[10px] mt-1 opacity-50 font-mono">
													Projects &gt; 100%
												</div>
											</motion.div>

											<div className="flex gap-4">
												<motion.div
													className="flex-1 bg-white/5 backdrop-blur-md p-4 rounded-3xl border border-white/10 border-l-4 border-l-[#4361EE] hover:-translate-y-1 transition-transform"
													initial={{ opacity: 0, x: -20 }}
													animate={{ opacity: 1, x: 0 }}
													transition={{ duration: 0.4, delay: 0.5 }}
												>
													<div className="text-3xl font-black mb-1 text-white">
														{leakFreeRate}%
													</div>
													<div className="text-[10px] font-bold uppercase text-[#4361EE] tracking-wider">
														Clean Code
													</div>
												</motion.div>
												<motion.div
													className="flex-1 bg-white/5 backdrop-blur-md p-4 rounded-3xl border border-white/10 border-l-4 border-l-[#F72585] hover:-translate-y-1 transition-transform"
													initial={{ opacity: 0, x: 20 }}
													animate={{ opacity: 1, x: 0 }}
													transition={{ duration: 0.4, delay: 0.6 }}
												>
													<div className="text-lg font-black mb-1 truncate text-white leading-8">
														{mostCommonFlag}
													</div>
													<div className="text-[10px] font-bold uppercase text-[#F72585] tracking-wider">
														Top Flag
													</div>
												</motion.div>
											</div>
										</div>
									</motion.div>
								)}
							</AnimatePresence>
						</div>
					)}

					{/* Step 10: Peer Wrapped */}
					{currentStep === 10 && (
						<div className="w-full h-full bg-[#240046] text-white flex flex-col items-center p-6 relative overflow-hidden pointer-events-auto">
							{/* Background - Always visible */}
							<div className="absolute inset-0 z-0">
								<div className="absolute inset-0 bg-gradient-to-b from-[#3c096c] to-[#10002b]" />
								<div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-[#5a189a]/30 to-transparent" />
							</div>

							<AnimatePresence>
								{!showQuote && (
									<motion.div
										className="relative z-10 w-full h-full flex flex-col justify-center my-20"
										initial={{ opacity: 0, scale: 0.9 }}
										animate={{ opacity: 1, scale: 1 }}
										transition={{ duration: 0.6 }}
									>
										<motion.h2
											className="text-5xl font-black uppercase tracking-tighter mb-4 text-center leading-none drop-shadow-[0_4px_0_rgba(0,0,0,1)]"
											initial={{ opacity: 0, y: -20 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ duration: 0.5, delay: 0.1 }}
										>
											Peer<br />
											<span className="text-[#e0aaff]">Review</span>
										</motion.h2>

										{/* Top Evaluators List */}
										<div className="w-full">
											<p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-4 ml-2">Frequent Guests</p>
											<div className="space-y-3">
												{topEvaluators.map((ev, i) => (
													<motion.div
														key={ev.name}
														className="flex items-center justify-between bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10"
														initial={{ opacity: 0, y: 10 }}
														animate={{ opacity: 1, y: 0 }}
														transition={{ duration: 0.4, delay: 0.1 + i * 0.05 }}
													>
														<div className="flex items-center gap-4">
															<div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#e0aaff] to-[#9d4edd] text-[#240046] flex items-center justify-center font-black text-sm">
																{i + 1}
															</div>
															<span className="font-bold text-base tracking-tight">{ev.name}</span>
														</div>
														<span className="text-sm font-mono opacity-50 font-bold">{ev.count} evals</span>
													</motion.div>
												))}
												{topEvaluators.length === 0 && (
													<motion.div
														className="p-4 text-center text-sm opacity-50 italic"
														initial={{ opacity: 0 }}
														animate={{ opacity: 1 }}
														transition={{ duration: 0.3, delay: 0.4 }}
													>
														No evaluations yet
													</motion.div>
												)}
											</div>
										</div>

										{/* Nicest Feedback */}
										{nicestFeedback && (
											<motion.div
												className="bg-[#240046]/50 p-4 rounded-xl border border-[#e0aaff]/30 backdrop-blur-sm relative mt-20 max-h-[120px] overflow-hidden"
												initial={{ opacity: 0, y: 30 }}
												animate={{ opacity: 1, y: 0 }}
												transition={{ duration: 0.5, delay: 0.8 }}
											>
												<div className="absolute top-2 right-2 text-2xl rotate-10 animate-pulse opacity-70">✨</div>
												<p className="text-[10px] font-bold text-[#e0aaff] uppercase mb-1">Highlight</p>
												<p className="text-xs italic leading-relaxed opacity-90 line-clamp-3">"{nicestFeedback.feedback}"</p>
											</motion.div>
										)}
									</motion.div>
								)}
							</AnimatePresence>
						</div>
					)}

					{/* Step 11: Identity Stats (The 42 DNA) - was Step 12/8 */}
					{currentStep === 11 && (
						<div className="w-full h-full bg-[#1db954] text-black flex flex-col items-center p-6 relative overflow-hidden pointer-events-auto">
							{/* Pattern BG - Always visible */}
							<div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

							<AnimatePresence>
								{!showQuote && (
									<motion.div
										className="relative z-10 w-full h-full flex flex-col justify-center gap-6"
										initial={{ opacity: 0, x: 30 }}
										animate={{ opacity: 1, x: 0 }}
										transition={{ duration: 0.6 }}
									>
										<motion.div
											className="text-center"
											initial={{ opacity: 0, y: -20 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ duration: 0.5, delay: 0.1 }}
										>
											<h2 className="text-5xl font-black tracking-tighter text-black inline-block border-b-4 border-black pb-2">
												THE 42 DNA
											</h2>
										</motion.div>

										<div className="grid grid-cols-2 gap-4">
											{/* Campus */}
											<motion.div
												className="bg-black text-[#1db954] p-5 rounded-2xl flex flex-col aspect-square justify-between group hover:scale-105 transition-transform"
												initial={{ opacity: 0, scale: 0.8 }}
												animate={{ opacity: 1, scale: 1 }}
												transition={{ duration: 0.4, delay: 0.2 }}
											>
												<div className="text-xs font-bold uppercase tracking-widest text-[#1db954]/70">Campus</div>
												<div className="text-2xl font-black break-words leading-tight">
													{user.campus?.[0]?.name || "42"}
												</div>
												<div className="w-8 h-8 rounded-full bg-[#1db954] text-black flex items-center justify-center font-bold">
													C
												</div>
											</motion.div>

											{/* Wallet */}
											<motion.div
												className="bg-white text-black p-5 rounded-2xl flex flex-col aspect-square justify-between border-2 border-black group hover:scale-105 transition-transform"
												initial={{ opacity: 0, scale: 0.8 }}
												animate={{ opacity: 1, scale: 1 }}
												transition={{ duration: 0.4, delay: 0.3 }}
											>
												<div className="text-xs font-bold uppercase tracking-widest opacity-60">Wallet</div>
												<div className="text-5xl font-black">
													{user.wallet}
													<span className="text-lg align-top">₳</span>
												</div>
												<div className="text-xs font-bold">Manage it wisely</div>
											</motion.div>

											{/* Eval Points */}
											<motion.div
												className="bg-[#191414] text-white p-5 rounded-2xl flex flex-col aspect-square justify-between group hover:scale-105 transition-transform"
												initial={{ opacity: 0, scale: 0.8 }}
												animate={{ opacity: 1, scale: 1 }}
												transition={{ duration: 0.4, delay: 0.4 }}
											>
												<div className="text-xs font-bold uppercase tracking-widest opacity-60">Eval Points</div>
												<div className="text-5xl font-black text-[#FFD700] drop-shadow-lg">
													{user.correction_point}
												</div>
											</motion.div>

											{/* Pool Year */}
											<motion.div
												className="bg-[#535353] text-white p-5 rounded-2xl flex flex-col aspect-square justify-between border-2 border-black group hover:scale-105 transition-transform"
												initial={{ opacity: 0, scale: 0.8 }}
												animate={{ opacity: 1, scale: 1 }}
												transition={{ duration: 0.4, delay: 0.5 }}
											>
												<div className="text-xs font-bold uppercase tracking-widest opacity-80">Pool</div>
												<div>
													<div className="text-xl font-bold capitalize">{user.pool_month}</div>
													<div className="text-4xl font-black">{user.pool_year}</div>
												</div>
											</motion.div>
										</div>

										<motion.div
											className="bg-black/10 backdrop-blur-sm p-4 rounded-xl border-2 border-black/10 mt-2"
											initial={{ opacity: 0, y: 20 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ duration: 0.5, delay: 0.7 }}
										>
											<div className="flex justify-between items-center">
												<span className="font-bold text-sm uppercase">Current Level</span>
												<span className="font-mono font-black text-2xl">
													{activeCursus.level?.toFixed(2) || "0.00"}
												</span>
											</div>
											<div className="w-full h-3 bg-white/50 rounded-full mt-2 overflow-hidden border border-black/10">
												<motion.div
													className="h-full bg-black"
													initial={{ width: 0 }}
													animate={{ width: `${(activeCursus.level % 1) * 100}%` }}
													transition={{ duration: 1, delay: 0.9 }}
												/>
											</div>
										</motion.div>
									</motion.div>
								)}
							</AnimatePresence>
						</div>
					)}
					{/* Step 12: Final Summary Card - was Step 9/13 */}
					{currentStep === 12 && (
						<div className="w-full h-full bg-[#121212] text-white flex flex-col items-center p-6 relative overflow-hidden pointer-events-auto">
							{/* Animated Background Glow */}
							<div className="absolute inset-0 z-0">
								<div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[#E91E63] rounded-full blur-[120px] opacity-20 animate-pulse" />
								<div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-[#4CAF50] rounded-full blur-[120px] opacity-20 animate-pulse" style={{ animationDelay: '1s' }} />
								<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#FFE600] rounded-full blur-[150px] opacity-10 animate-pulse" style={{ animationDelay: '0.5s' }} />
							</div>
							<motion.div
								id="summary-card"
								className="w-full h-full flex flex-col bg-gradient-to-br from-[#1e1e1e] via-[#151515] to-[#000] rounded-2xl p-6 relative border border-white/10 shadow-2xl"
								initial={{ opacity: 0, scale: 0.9, rotateX: 10 }}
								animate={{ opacity: 1, scale: 1, rotateX: 0 }}
								transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
							>
								{/* Decorative Background - Always visible */}
								<div className="absolute inset-0 z-0 opacity-15" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
								{/* Shimmer Effect */}
								<div className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_3s_ease-in-out_infinite]" />

								<AnimatePresence>
									{!showQuote && (
										<motion.div
											className="relative z-10 w-full h-full flex flex-col"
											initial={{ opacity: 0, scale: 0.95 }}
											animate={{ opacity: 1, scale: 1 }}
											transition={{ duration: 0.8, ease: "easeOut" }}
										>
											{/* Header */}
											<motion.div
												className="flex items-center gap-4 mb-4"
												initial={{ opacity: 0, y: -20 }}
												animate={{ opacity: 1, y: 0 }}
												transition={{ duration: 0.5, delay: 0.1 }}
											>
												<motion.div
													className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/80 shadow-lg shrink-0 relative"
												>
													{/* Avatar Glow Ring */}
													<div className="absolute -inset-1 rounded-full blur-sm opacity-60" />
													{avatarDataUrl || user.image?.link ? (
														<img
															src={avatarDataUrl || user.image.link}
															alt={user.login}
															className="w-full h-full object-cover"
															crossOrigin="anonymous"
														/>
													) : (
														<div className="w-full h-full bg-gray-900 flex items-center justify-center text-xl font-black">
															{user.login?.[0]?.toUpperCase()}
														</div>
													)}
												</motion.div>
												<div className="min-w-0">
													<motion.h2
														className="text-2xl font-black tracking-tighter leading-none text-white truncate"
														initial={{ opacity: 0, x: -10 }}
														animate={{ opacity: 1, x: 0 }}
														transition={{ delay: 0.1 }}
													>
														{user.displayname || user.login}
													</motion.h2>
													<p className="font-mono text-xs opacity-60">@{user.login}</p>
												</div>
												<motion.div
													className="ml-auto"
													initial={{ rotate: -20, scale: 0 }}
													animate={{ rotate: 3, scale: 1 }}
													transition={{ type: "spring", stiffness: 300, delay: 0.2 }}
												>
													<div className="bg-[#FFE600] text-black font-black text-[10px] px-2 py-1 rounded shadow-[2px_2px_0px_white]">
														#{currentYear}
													</div>
												</motion.div>
											</motion.div>

											{/* VERDICT BANNER */}
											<motion.div
												className="relative w-full bg-gradient-to-r from-[#F1C40F] via-[#E67E22] to-[#F1C40F] text-black p-4 rounded-xl mb-4 shadow-lg overflow-hidden"
												initial={{ opacity: 0, x: -30, scale: 0.95 }}
												animate={{ opacity: 1, x: 0, scale: 1 }}
												transition={{ duration: 0.6, delay: 0.2, type: "spring" }}
												whileHover={{ scale: 1.02 }}
												style={{ backgroundSize: '200% 100%' }}
											>
												{/* Animated Gradient Shine */}
												<motion.div
													className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
													initial={{ x: '-100%' }}
													animate={{ x: '100%' }}
													transition={{ duration: 1.5, delay: 0.4, ease: "easeInOut" }}
												/>
												<div className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">The Verdict</div>
												<motion.div
													className="text-2xl font-black leading-tight uppercase tracking-tight"
													initial={{ opacity: 0, y: 10 }}
													animate={{ opacity: 1, y: 0 }}
													transition={{ delay: 0.2 }}
												>
													{personality}
												</motion.div>
												<div className="text-xs font-bold opacity-80 mt-1 leading-tight">
													{personalityDesc}
												</div>
												<motion.div
													className="absolute right-2 top-2 text-4xl pointer-events-none"
													initial={{ scale: 0, rotate: -180 }}
													animate={{ scale: 1, rotate: 0, opacity: 0.3 }}
													transition={{ type: "spring", stiffness: 200, delay: 0.5 }}
												>
													👑
												</motion.div>
											</motion.div>
											{/* Stats Grid */}
											<div className="grid grid-cols-2 gap-3 flex-1 overflow-hidden">
												<motion.div
													className="bg-gradient-to-br from-[#E91E63] to-[#C2185B] p-3 rounded-xl text-white flex flex-col justify-between shadow-lg relative overflow-hidden group"
													initial={{ opacity: 0, scale: 0.8, y: 20 }}
													animate={{ opacity: 1, scale: 1, y: 0 }}
													transition={{ duration: 0.4, delay: 0.3, type: "spring" }}
													whileHover={{ scale: 1.05, y: -2 }}
												>
													<div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
													<div className="text-[10px] font-bold uppercase opacity-80">Projects</div>
													<div>
														<motion.div
															className="text-3xl font-black"
															initial={{ scale: 0 }}
															animate={{ scale: 1 }}
															transition={{ type: "spring", delay: 0.5 }}
														>
															{totalProjects}
														</motion.div>
														<div className="text-[10px] leading-tight opacity-90 mt-0.5">
															Best: {topProjects[0]?.final_mark || 0}%
														</div>
													</div>
												</motion.div>

												<motion.div
													className="bg-gradient-to-br from-[#4CAF50] to-[#2E7D32] p-3 rounded-xl text-white flex flex-col justify-between shadow-lg relative overflow-hidden group"
													initial={{ opacity: 0, scale: 0.8, y: 20 }}
													animate={{ opacity: 1, scale: 1, y: 0 }}
													transition={{ duration: 0.4, delay: 0.3, type: "spring" }}
													whileHover={{ scale: 1.05, y: -2 }}
												>
													<div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
													<div className="text-[10px] font-bold uppercase opacity-80">Log Hours</div>
													<div>
														<motion.div
															className="text-3xl font-black"
															initial={{ scale: 0 }}
															animate={{ scale: 1 }}
															transition={{ type: "spring", delay: 0.2 }}
														>
															{Math.round(totalLogMinutes / 60)}h
														</motion.div>
														<div className="text-[10px] leading-tight opacity-90 mt-0.5">
															Peak Day: {peakDayShort}
														</div>
													</div>
												</motion.div>

												<motion.div
													className="bg-gradient-to-br from-[#2196F3] to-[#1565C0] p-3 rounded-xl text-white flex flex-col justify-between shadow-lg relative overflow-hidden group"
													initial={{ opacity: 0, scale: 0.8, y: 20 }}
													animate={{ opacity: 1, scale: 1, y: 0 }}
													transition={{ duration: 0.2, delay: 0.7, type: "spring" }}
													whileHover={{ scale: 1.05, y: -2 }}
												>
													<div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
													<div className="text-[10px] font-bold uppercase opacity-80">Quality</div>
													<div>
														<motion.div
															className="text-3xl font-black"
															initial={{ scale: 0 }}
															animate={{ scale: 1 }}
															transition={{ type: "spring", delay: 0.5 }}
														>
															{outstandingCount}
														</motion.div>
														<div className="text-[10px] leading-tight opacity-90 mt-0.5">
															Outstanding
														</div>
													</div>
												</motion.div>

												<motion.div
													className="bg-gradient-to-br from-[#9C27B0] to-[#6A1B9A] p-3 rounded-xl text-white flex flex-col justify-between shadow-lg relative overflow-hidden group"
													initial={{ opacity: 0, scale: 0.8, y: 20 }}
													animate={{ opacity: 1, scale: 1, y: 0 }}
													transition={{ duration: 0.4, delay: 0.4, type: "spring" }}
													whileHover={{ scale: 1.05, y: -2 }}
												>
													<div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
													<div className="text-[10px] font-bold uppercase opacity-80">Evaluation Speed</div>
													<div>
														<motion.div
															className="text-3xl font-black"
															initial={{ scale: 0 }}
															animate={{ scale: 1 }}
															transition={{ type: "spring", delay: 0.5 }}
														>
															{avgEvalTime} min
														</motion.div>
														<div className="text-[10px] leading-tight opacity-90 mt-0.5">
															{avgEvalTime < 20 ? 'Speedy!' : 'Thorough'}
														</div>
													</div>
												</motion.div>
											</div>

											{/* Footer Branding */}
											<motion.div
												className="mt-4 flex justify-between items-center flex-col"
												initial={{ opacity: 0, y: 10 }}
												animate={{ opacity: 0.5, y: 0 }}
												transition={{ duration: 0.5, delay: 0.3 }}
											>
												<div className="font-black text-xl italic tracking-tighter bg-gradient-to-r from-white/60 to-white/30 bg-clip-text text-transparent">42wrapped.vercel.app</div>
												<div className="font-black text-l tracking-tighter bg-gradient-to-r from-white/60 to-white/30 bg-clip-text text-transparent">By <a href="https://github.com/MossaJehad">Mossa Jehad</a></div>
											</motion.div>
										</motion.div>
									)}
								</AnimatePresence>
							</motion.div>

							{/* Actions (Screenshot/Share) */}
							<motion.div
								className="mt-6 flex gap-3 w-full justify-center self-center"
								initial={{ opacity: 0, y: 30, scale: 0.9 }}
								animate={{ opacity: 1, y: 0, scale: 1 }}
								transition={{ delay: 1.4, type: "spring", stiffness: 200 }}
							>
								<motion.button
									onClick={async () => {
										const node = document.getElementById('summary-card');
										if (node) {
											try {
												const { toJpeg } = await import('html-to-image');

												// Give the browser a micro-task to ensure everything is painted
												await new Promise(r => setTimeout(r, 50));

												const dataUrl = await toJpeg(node, {
													quality: 0.95,
													pixelRatio: 2,
													backgroundColor: '#121212',
													skipFonts: true,
													cacheBust: true,
													style: {
														transform: 'none',
													}
												});

												if (dataUrl) {
													const link = document.createElement('a');
													link.href = dataUrl;
													link.download = `42wrapped-${user.login}-${currentYear}.jpg`;
													link.click();
												}
											} catch (err) {
												console.error('Failed to download image', err);
												alert('Failed to generate image. Please try a manual screenshot.');
											}
										}
									}}
									className="cursor-pointer w-48 bg-white text-black font-black uppercase tracking-tighter py-4 rounded-xl shadow-[6px_6px_0px_#FFE600] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all relative overflow-hidden group"
									whileHover={{ scale: 1.05 }}
									whileTap={{ scale: 0.95 }}
								>
									<span className="relative z-10">Save as Image</span>
									<motion.div
										className="absolute inset-0 transition-opacity"
									/>
								</motion.button>
							</motion.div>
						</div>
					)}
				</div>
				<MusicPlayerWidget isPaused={isPaused} />
			</div>
		</div>
	);
}
