
import { useState, useEffect, useCallback } from 'react';
import { cn } from '../lib/utils';
import { ChevronLeft, ChevronRight, Clock, Users } from 'lucide-react';
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

	// --- Data Processing for 2025 ---
	const currentYear = 2025;
	const totalSteps = 13;

	// 1. Projects
	const projects = user.projects_users || [];
	const projects2025 = projects.filter((p: any) => {
		if (!p.marked_at) return false;
		return new Date(p.marked_at).getFullYear() === currentYear && p.status === 'finished' && p['validated?'];
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

	console.groupEnd();


	const topSkills = [...skills].sort((a: any, b: any) => b.level - a.level).slice(0, 5);

	// 4. Log Time (Last 4 Months)
	const now = new Date();
	const fourMonthsAgo = new Date();
	fourMonthsAgo.setMonth(now.getMonth() - 4);

	// Helper to process intervals
	const dayIntervals = new Map<string, Array<{ start: number, end: number }>>();

	locations.forEach((loc: any) => {
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
	// Filter teams that have more than 1 user and were active in 2025
	const groupTeams = teams.filter((t: any) => {
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
	const sourceAchievements = (achievements && achievements.length > 0) ? achievements : (user.achievements || []);
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

	// Console log for debugging
	console.log("FINAL 2025 ACHIEVEMENTS LIST:", achievementsFiltered);
	console.log("Display Achievements:", displayAchievements);

	// --- NEW DATA LOGIC FOR WRAPPED EXTENSIONS ---
	const myId = user.id;
	const allEvals = evaluations || [];

	// Filter 2025 evals
	const evals2025 = allEvals.filter((e: any) => {
		const d = new Date(e.filled_at || e.begin_at);
		return d.getFullYear() === currentYear;
	});

	// 1. As Corrector (I evaluated others)
	const asCorrector = evals2025.filter((e: any) => e.corrector?.id === myId);

	// 2. As Corrected (I was evaluated)
	const asCorrected = evals2025.filter((e: any) => e.correcteds?.some((u: any) => u.id === myId));

	// --- Time Wrapped Stats ---
	const evalDurations = asCorrector.map((e: any) => {
		if (!e.begin_at || !e.filled_at) return null;
		const start = new Date(e.begin_at).getTime();
		const end = new Date(e.filled_at).getTime();
		return (end - start) / 1000 / 60; // minutes
	}).filter((d: any) => d !== null && d > 0) as number[];

	const fastestEval = evalDurations.length ? Math.min(...evalDurations) : 0;
	const longestEval = evalDurations.length ? Math.max(...evalDurations) : 0;
	const avgEvalTime = evalDurations.length
		? Math.round(evalDurations.reduce((a, b) => a + b, 0) / evalDurations.length)
		: 0;

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

	// --- Peer Wrapped ---
	const ratingsReceived = asCorrector.map((e: any) => e.feedback_rating).filter((r: any) => r !== null && r !== undefined);
	const avgPeerRating = ratingsReceived.length
		? (ratingsReceived.reduce((a: any, b: any) => a + b, 0) / ratingsReceived.length).toFixed(1)
		: "N/A";

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
	const niceFeedbacks = asCorrector.filter((e: any) => e.feedback_rating === 5 && e.feedback && e.feedback.length > 5);
	const nicestFeedback = niceFeedbacks.sort((a: any, b: any) => b.feedback.length - a.feedback.length)[0];

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

	// Auto-advance logic
	useEffect(() => {
		if (isPaused) return;

		const timer = setTimeout(() => {
			nextStep();
		}, 5000);

		return () => clearTimeout(timer);
	}, [currentStep, isPaused, nextStep]);

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black animate-in fade-in zoom-in-95 duration-500">
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
			<div className="relative w-full h-full md:w-[400px] md:h-[800px] md:rounded-2xl overflow-hidden bg-background">

				{/* Progress Bars */}
				<div className="absolute top-4 left-0 right-0 z-20 flex gap-1 px-2">
					{Array.from({ length: totalSteps }).map((_, idx) => (
						<div key={idx} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
							<div
								className={cn(
									"h-full bg-white transition-all duration-500 ease-linear",
									idx < currentStep ? "w-full" :
										idx === currentStep ? "animate-story-progress w-full" : "w-0"
								)}
								style={{
									animationDuration: '5s',
									animationPlayState: idx === currentStep && !isPaused ? 'running' : 'paused'
								}}
							/>
						</div>
					))}
				</div>

				{/* Tap Areas for Navigation */}
				<div className="absolute inset-0 z-10 flex">
					<div className="w-1/3 h-full" onClick={prevStep} />
					<div className="w-2/3 h-full" onClick={nextStep} />
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

				{/* Story Content */}
				<div className="w-full h-full relative">

					{/* Slide 1: User Profile */}
					{currentStep === 0 && (
						<div className="w-full h-full bg-[#7000FF] text-white flex flex-col items-center justify-center p-8 animate-in fade-in duration-500 relative overflow-hidden">
							{/* Background Sunburst Effect */}
							<div className="absolute inset-0 flex items-center justify-center z-0 opacity-20">
								<div className="min-w-[1200px] min-h-[1200px] bg-[conic-gradient(from_0deg_at_50%_50%,_transparent_0deg,_#000_20deg,_transparent_40deg,_#000_60deg,_transparent_80deg,_#000_100deg,_transparent_120deg,_#000_140deg,_transparent_160deg,_#000_180deg,_transparent_200deg,_#000_220deg,_transparent_240deg,_#000_260deg,_transparent_280deg,_#000_300deg,_transparent_320deg,_#000_340deg,_transparent_360deg)] animate-[spin_20s_linear_infinite]" />
							</div>

							<div className="relative z-10 flex flex-col items-center">
								<div className="relative mb-8 group">
									<div className="absolute -inset-2 bg-gradient-to-r from-yellow-400 to-pink-500 rounded-full animate-spin-slow opacity-75 blur-md" />
									<div className="relative w-40 h-40 rounded-full border-4 border-black overflow-hidden bg-black shadow-2xl transform transition group-hover:scale-105">
										{user.image?.link ? (
											<img src={user.image.link} alt={user.login} className="w-full h-full object-cover" />
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
										Your 2025 Wrapped is served.
									</p>
								</div>
							</div>
						</div>
					)}

					{/* Slide 2: Achievements - "Top List" Style -> Now Step 6 */}
					{currentStep === 6 && (
						<div className="w-full h-full bg-[#FF4500] text-white flex flex-col relative overflow-hidden p-6 font-sans animate-in slide-in-from-right duration-500">
							{/* Zig Zag Pattern */}
							<div className="absolute inset-0 z-0 opacity-10"
								style={{
									backgroundImage: 'linear-gradient(135deg, #000 25%, transparent 25%), linear-gradient(225deg, #000 25%, transparent 25%), linear-gradient(45deg, #000 25%, transparent 25%), linear-gradient(315deg, #000 25%, transparent 25%)',
									backgroundPosition: '10px 0, 10px 0, 0 0, 0 0',
									backgroundSize: '20px 20px',
									backgroundRepeat: 'repeat'
								}}
							/>

							{/* Large background decorative Achievement Icon */}
							<svg className="absolute -right-20 top-20 w-96 h-96 opacity-10 rotate-12" viewBox="0 0 24 24" fill="currentColor">
								<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
							</svg>

							<div className="relative z-10 w-full h-full flex flex-col">
								{/* Title */}
								<div className="mt-12 mb-8 animate-in slide-in-from-bottom-10 fade-in duration-1000 delay-100 fill-mode-forwards">
									<h2 className="text-6xl font-black tracking-tighter uppercase leading-[0.8] mb-4">
										Level<br />
										<span className="text-black inline-block transform -skew-x-12 bg-white px-2">UP!</span>
									</h2>
								</div>

								{/* The List 1-5 */}
								<div className="flex flex-col gap-3 w-full flex-1 overflow-y-auto no-scrollbar">
									{displayAchievements.map((ach: any, idx: number) => (
										<div key={ach.id} className="flex items-center gap-4 group">
											{/* Number */}
											<div className="w-10 h-10 flex-shrink-0 bg-black text-[#FF4500] font-black text-2xl flex items-center justify-center rounded-lg shadow-lg border-2 border-white transform group-hover:rotate-12 transition-transform animate-in zoom-in spin-in-12 duration-500 delay-300">
												{idx + 1}
											</div>

											{/* Name Box */}
											<div className="flex-1 bg-white/90 backdrop-blur-sm text-black font-bold text-sm md:text-base px-4 py-3 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform transition hover:translate-x-1 hover:-translate-y-1">
												<span className="line-clamp-2 leading-tight">
													{ach.name}
												</span>
											</div>
										</div>
									))}

									{displayAchievements.length === 0 && (
										<div className="flex-1 flex items-center justify-center">
											<div className="bg-black/20 p-6 rounded-2xl text-center border-2 border-dashed border-white/50">
												<p className="font-bold text-xl uppercase">No unlocks yet</p>
											</div>
										</div>
									)}
								</div>

								{/* Count Summary */}
								<div className="mt-6 pt-6 border-t-4 border-black/10">
									<div className="flex justify-between items-end">
										<div className="font-black text-sm uppercase max-w-[100px] leading-tight opacity-80 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
											Total Unlocked in 2025
										</div>
										<div className="text-8xl font-black leading-none tracking-tighter drop-shadow-lg animate-in zoom-in fade-in duration-700 delay-700">
											{achievementsFiltered.length}
										</div>
									</div>
								</div>
							</div>
						</div>
					)}

					{/* Slide 3: Projects 2025 Card -> Now Step 1 */}
					{currentStep === 1 && (
						<div className="w-full h-full bg-[#00E5FF] text-black flex flex-col items-center p-6 animate-in slide-in-from-right duration-500 relative overflow-hidden">
							{/* Background Grid */}
							<div className="absolute inset-0 z-0 opacity-20"
								style={{
									backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
									backgroundSize: '40px 40px'
								}}
							/>

							{/* Floating Elements */}
							<div className="absolute top-10 right-10 text-6xl font-mono font-black opacity-10 rotate-12">{`</>`}</div>
							<div className="absolute bottom-20 left-10 text-8xl font-mono font-black opacity-10 -rotate-12">{`{ }`}</div>

							<div className="relative z-10 w-full h-full flex flex-col">
								<h2 className="text-6xl font-black tracking-tighter mb-8 text-left mt-10 animate-in slide-in-from-left fade-in duration-1000 delay-100">
									CODE
									<br />
									<span className="text-white bg-black px-2 py-0">MODE</span>
								</h2>

								<div className="grid grid-cols-2 gap-4 mb-6">
									<div className="bg-[#2d3436] text-[#00E5FF] p-4 rounded-tl-3xl rounded-br-3xl rounded-tr-lg rounded-bl-lg border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between aspect-[4/3] animate-in zoom-in fade-in duration-700 delay-300">
										<div className="text-5xl font-black">{totalProjects}</div>
										<div className="text-xs uppercase font-bold tracking-widest text-white">
											Projects
										</div>
									</div>
									<div className="bg-white text-black p-4 rounded-tr-3xl rounded-bl-3xl rounded-tl-lg rounded-br-lg border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between aspect-[4/3] animate-in zoom-in fade-in duration-700 delay-500">
										<div className="text-5xl font-black">{averageMark}%</div>
										<div className="text-xs uppercase font-bold tracking-widest opacity-60">
											Avg Score
										</div>
									</div>
								</div>

								<div className="flex-1 bg-black text-white p-6 rounded-3xl border-4 border-white/20 overflow-hidden relative">
									<div className="absolute top-0 right-0 p-4 opacity-20 font-mono text-xs">
										top_projects.json
									</div>
									<p className="font-bold text-sm uppercase tracking-widest text-[#00E5FF] mb-4">
										Top Highlights
									</p>
									<div className="space-y-4">
										{topProjects.slice(0, 5).map((p: any) => (
											<div key={p.id} className="flex items-center justify-between border-b border-white/10 pb-2 last:border-0">
												<span className="font-bold text-lg truncate w-2/3">{p.project.name}</span>
												<span className={`font-black text-xl ${p.final_mark >= 100 ? 'text-[#00E5FF]' : 'text-white'}`}>
													{p.final_mark}
												</span>
											</div>
										))}
									</div>

									{topProjects.length === 0 && (
										<div className="h-full flex items-center justify-center opacity-50 font-mono">
											// No data found
										</div>
									)}
								</div>
							</div>
						</div>
					)}

					{/* Slide 4: Skills Card -> Now Step 3 */}
					{currentStep === 3 && (
						<div className="w-full h-full bg-[#E056FD] text-white flex flex-col items-center p-8 animate-in slide-in-from-right duration-500 relative overflow-hidden">
							{/* Pattern BG: Polka Dots */}
							<div className="absolute inset-0 opacity-20"
								style={{
									backgroundImage: 'radial-gradient(circle, #000 2px, transparent 2.5px)',
									backgroundSize: '24px 24px'
								}}
							/>

							{/* Gradient Blobs */}
							<div className="absolute top-0 right-0 w-64 h-64 bg-yellow-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-pulse" />
							<div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-pulse delay-700" />

							<div className="relative z-10 w-full flex-1 flex flex-col justify-center">
								<h2 className="text-5xl font-black tracking-tighter mb-10 text-right animate-in slide-in-from-right fade-in duration-1000 delay-100">
									SKILL
									<br />
									<span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-white text-6xl drop-shadow-sm">STACK</span>
								</h2>

								<div className="w-full space-y-6">
									{topSkills.map((skill: any, index: number) => (
										<div key={skill.id} className="w-full relative group animate-in slide-in-from-bottom-4 fade-in duration-700" style={{ animationDelay: `${300 + index * 100}ms` }}>
											<div className="flex justify-between mb-2 text-lg font-black uppercase tracking-tight z-10 relative">
												<span className="bg-black/20 px-2 rounded backdrop-blur-sm">{skill.name}</span>
												<span className="text-yellow-300 drop-shadow-md">{skill.level.toFixed(2)}</span>
											</div>
											<div className="h-6 w-full bg-black/30 rounded-full overflow-hidden border-2 border-black/20 backdrop-blur-sm">
												<div
													className="h-full bg-gradient-to-r from-yellow-300 via-white to-yellow-300 rounded-full"
													style={{
														width: `${Math.min((skill.level / 10) * 100, 100)}%`,
														transitionDelay: `${800 + index * 100}ms`
													}}
												/>
											</div>
										</div>
									))}
								</div>

								{topSkills.length === 0 && (
									<div className="bg-white/10 p-6 rounded-2xl text-center border-2 border-white/20 backdrop-blur-md">
										<p className="font-bold">Loading skills...</p>
									</div>
								)}
							</div>
						</div>
					)}

					{/* Step 4: Log Time Stats */}
					{currentStep === 4 && (
						<div className="w-full h-full bg-[#2C3E50] text-white flex flex-col items-center p-6 animate-in slide-in-from-right duration-500 relative overflow-hidden">
							<div className="absolute inset-0 opacity-10 pointer-events-none">
								<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border-[2px] border-white rounded-full animate-[spin_60s_linear_infinite]" />
								<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border-[2px] border-white rounded-full animate-[spin_40s_linear_infinite_reverse]" />
							</div>

							<div className="relative z-10 w-full h-full flex flex-col justify-center">
								<div className="flex items-center gap-3 mb-8 animate-in slide-in-from-top-4 fade-in duration-700 delay-100">
									<Clock size={40} className="text-[#3498DB]" />
									<h2 className="text-4xl font-black uppercase tracking-tighter">
										Time<br />Machine
									</h2>
								</div>

								<p className="font-mono font-bold text-sm uppercase opacity-88 mb-8 border-b border-white/20 pb-2 animate-in fade-in duration-700 delay-300">
									Last <span className="bg-white text-[#000] px-1.5 rounded mx-1 text-base font-black border-2 border-[#3498DB] shadow-[2px_2px_0px_#3498DB] transform -rotate-6 inline-block">4</span> Months Activity
								</p>

								<div className="space-y-6 w-full max-w-xs mx-auto">
									<div className="bg-black/20 p-5 rounded-2xl border border-white/10 backdrop-blur-sm">
										<div className="text-3xl font-black text-[#3498DB]">
											{formatDuration(maxLogMinutes)}
										</div>
										<div className="text-xs uppercase font-bold opacity-60 mt-1">
											Longest Day
										</div>
									</div>

									<div className="bg-black/20 p-5 rounded-2xl border border-white/10 backdrop-blur-sm">
										<div className="text-3xl font-black text-white">
											{formatDuration(avgLogMinutes)}
										</div>
										<div className="text-xs uppercase font-bold opacity-60 mt-1">
											Daily Average
										</div>
									</div>

									<div className="bg-white/10 p-5 rounded-2xl border border-white/10 backdrop-blur-sm animate-in slide-in-from-bottom-8 fade-in duration-700 delay-700">
										<div className="text-3xl font-black text-[#FFD700]">
											{formatDuration(totalLogMinutes)}
										</div>
										<div className="text-xs uppercase font-bold opacity-60 mt-1">
											Total Tracked
										</div>
									</div>
								</div>
							</div>
						</div>
					)}

					{/* Step 5: The Rhythm (Weekly Activity) */}
					{currentStep === 5 && (
						<div className="w-full h-full bg-[#8E44AD] text-white flex flex-col items-center p-6 animate-in slide-in-from-right duration-500 relative overflow-hidden">
							<div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

							<div className="relative z-10 w-full h-full flex flex-col justify-center mt-10">
								<div className="mb-4 flex flex-col items-center text-center animate-in slide-in-from-top-4 fade-in duration-700 delay-100">
									<h2 className="text-5xl font-black uppercase tracking-tighter leading-none mb-2">
										The<br /><span className="text-[#F1C40F]">Rhythm</span>
									</h2>
									<p className="font-mono text-xs opacity-70 uppercase tracking-widest pl-1">
										Your Weekly Flow
									</p>
								</div>

								{/* Calculation Logic (Inline) */}
								{(() => {
									const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
									const dayCounts = [0, 0, 0, 0, 0, 0, 0];

									// Reuse dayIntervals from Step 4 if possible, or recalculate briefly
									// Since dayIntervals is in scope (calculated above), we iterate it.
									dayIntervals.forEach((intervals, dateKey) => {
										const date = new Date(dateKey);
										const dayIndex = date.getDay(); // 0 = Sun

										let minutes = 0;
										intervals.forEach(i => {
											minutes += (i.end - i.start) / 1000 / 60;
										});
										dayCounts[dayIndex] += minutes;
									});

									const maxMinutes = Math.max(...dayCounts, 1); // Avoid div by 0
									const maxDayIndex = dayCounts.indexOf(Math.max(...dayCounts));
									const peakDayFull = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][maxDayIndex];

									return (
										<div className="w-full flex-1 flex flex-col items-center justify-between py-4">

											{/* Peak Day Display */}
											<div className="flex-1 flex flex-col justify-center items-center text-center gap-6 w-full">
												<div className="transform transition hover:scale-105 duration-500">
													<div className="text-sm font-bold opacity-80 uppercase tracking-widest mb-2">
														Most Productive Day
													</div>
													<div className="text-6xl md:text-7xl font-black text-[#F1C40F] drop-shadow-[6px_6px_0px_rgba(0,0,0,0.3)]">
														{peakDayFull}
													</div>
												</div>

												<p className="max-w-[280px] text-lg font-medium leading-relaxed opacity-90 bg-black/10 p-4 rounded-xl backdrop-blur-sm border border-white/10">
													"You were absolutely unstoppable this month. Whatever coffee you were drinking, keep buying it."
												</p>
											</div>

											{/* Bar Chart */}
											<div className="w-full h-40 flex items-end justify-between gap-2 px-4 pb-4">
												{dayCounts.map((minutes, idx) => {
													const heightPercent = Math.max((minutes / maxMinutes) * 100, 10); // Min 10% for visibility
													const isPeak = idx === maxDayIndex;

													return (
														<div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
															<div className="w-full relative flex items-end justify-center h-full">
																<div
																	className={`w-full rounded-t-lg transition-all duration-1000 ease-out ${isPeak ? 'bg-[#F1C40F] shadow-[0_0_15px_rgba(241,196,15,0.6)]' : 'bg-white/30 group-hover:bg-white/50'}`}
																	style={{ height: `${heightPercent}%` }}
																>
																</div>
																{/* Tooltipish count */}
																<div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] font-bold px-2 py-1 rounded whitespace-nowrap pointer-events-none transition-opacity z-20">
																	{Math.round(minutes / 60)}h
																</div>
															</div>
															<div className={`text-xs font-black uppercase tracking-tighter ${isPeak ? 'text-[#F1C40F]' : 'text-white/50'}`}>
																{daysOfWeek[idx]}
															</div>
														</div>
													);
												})}
											</div>
										</div>
									);
								})()}
							</div>
						</div>
					)}

					{/* Step 6: Group Projects -> Now Step 7 */}
					{currentStep === 7 && (
						<div className="w-full h-full bg-[#E74C3C] text-white flex flex-col items-center p-6 animate-in slide-in-from-right duration-500 relative overflow-hidden">
							<div className="absolute inset-0 opacity-20 pointer-events-none">
								<Users size={400} className="absolute -bottom-20 -right-20 rotate-12 opacity-30" />
							</div>

							<div className="relative z-10 w-full h-full flex flex-col pt-12">
								<h2 className="text-5xl font-black uppercase tracking-tighter mb-8 text-left leading-[0.85] animate-in slide-in-from-left fade-in duration-700 delay-100">
									Dream<br /><span className="text-black bg-white px-2">Team</span>
								</h2>

								<div className="flex-1 overflow-y-auto w-full no-scrollbar space-y-4 pb-12">
									{groupTeams.length > 0 ? (
										groupTeams.map((team: any, idx: number) => (
											<div key={team.id} className="bg-black/20 p-4 rounded-xl border-l-4 border-white backdrop-blur-sm hover:bg-black/30 transition-colors animate-in slide-in-from-bottom-4 fade-in duration-500" style={{ animationDelay: `${300 + idx * 150}ms` }}>
												<div className="font-bold text-xl mb-1">
													{team.project_id /* Ideally retrieve project name from ID or included data */}
													{/* If 'project' object not populated, try to check if 'name' exists on team or project relation */}
													{team.name || `Team #${team.id}`}
												</div>
												<div className="flex -space-x-2 overflow-hidden mt-3">
													{team.users?.map((u: any) => (
														<div key={u.id} className="inline-block h-8 w-8 rounded-full ring-2 ring-[#E74C3C] bg-gray-800 flex items-center justify-center text-xs font-bold overflow-hidden" title={u.login}>
															{u.image?.versions?.small || u.image?.link ? (
																<img
																	src={u.image.versions?.small || u.image.link}
																	alt={u.login}
																	className="w-full h-full object-cover"
																/>
															) : (
																u.login?.[0]?.toUpperCase()
															)}
														</div>
													))}
												</div>
												<div className="items-center mt-2 text-xs font-mono opacity-70 flex gap-2">
													<Users size={12} />
													{team.users?.length || 0} Members
												</div>
											</div>
										))
									) : (
										<div className="h-40 flex items-center justify-center bg-white/10 rounded-2xl border-2 border-dashed border-white/30">
											<div className="text-center opacity-70">
												<p className="font-bold">No group projects</p>
												<p className="text-xs">in 2025</p>
											</div>
										</div>
									)}
								</div>

								<div className="mt-4 pt-4 border-t border-white/20 text-center">
									<div className="text-4xl font-black">{groupTeams.length}</div>
									<div className="text-xs uppercase font-bold tracking-widest opacity-70">Co-op Missions</div>
								</div>
							</div>
						</div>
					)}

					{/* Step 7: Bonus Projects (Over Achiever) - was previously Step 4 -> Now Step 2 */}
					{currentStep === 2 && (
						<div className="w-full h-full bg-[#FFD700] text-black flex flex-col items-center p-8 animate-in slide-in-from-right duration-500 relative overflow-hidden">
							{/* Trippy Geometric BG */}
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

							<div className="relative z-10 w-full flex-1 flex flex-col justify-center">
								<h2 className="text-6xl font-black tracking-tighter mb-2 text-center leading-[0.8]">
									OVER
									<br />
									<span className="text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]">ACHIEVER</span>
								</h2>
								<p className="text-center font-bold uppercase tracking-widest opacity-80 mb-10">
									Going above & beyond
								</p>

								<div className="space-y-4 w-full">
									{bonusProjects.length > 0 ? (
										bonusProjects.map((p: any) => (
											<div key={p.id} className="relative bg-black text-[#FFD700] p-4 rounded-xl border-2 border-black transform transition hover:scale-105 hover:-rotate-1">
												<div className="flex justify-between items-baseline">
													<span className="text-lg font-black truncate w-2/3">{p.project.name}</span>
													<span className="text-3xl font-black">{p.final_mark}%</span>
												</div>
												<div className="absolute -top-2 -right-2 bg-white text-black text-[10px] font-bold px-2 py-0.5 rounded-full border border-black">
													BONUS
												</div>
											</div>
										))
									) : (
										<div className="bg-black/10 p-6 rounded-2xl text-center border-2 border-black/10">
											<p className="font-bold">No bonus projects yet.</p>
											<p className="text-sm opacity-70">Push harder next year!</p>
										</div>
									)}
								</div>

								{bonusProjects.length > 0 && (
									<div className="mt-8 text-center font-bold uppercase text-xs tracking-widest bg-black text-white py-1 px-3 rounded-full self-center">
										{bonusProjects.length} Projects &gt; 100%
									</div>
								)}
							</div>
						</div>
					)}




					{/* Step 8: Time Wrapped (Evaluations Duration) */}
					{currentStep === 8 && (
						<div className="w-full h-full bg-[#34495E] text-white flex flex-col items-center p-6 animate-in slide-in-from-right duration-500 relative overflow-hidden">
							<div className="absolute inset-0 opacity-10 pointer-events-none">
								<Clock size={400} className="absolute -left-20 -bottom-20 rotate-12" />
							</div>

							<div className="relative z-10 w-full h-full flex flex-col justify-center">
								<h2 className="text-5xl font-black uppercase tracking-tighter mb-10 text-right leading-none">
									Time<br />
									<span className="text-[#3498DB]">Wrapped</span>
								</h2>

								<div className="space-y-6">
									<div className="bg-white/10 p-4 rounded-xl backdrop-blur-md border-l-4 border-[#3498DB] animate-in slide-in-from-bottom-4 fade-in duration-500 delay-100">
										<p className="text-xs font-bold uppercase opacity-60 mb-1">Fastest Eval</p>
										<div className="text-3xl font-black">{fastestEval.toFixed(0)} min</div>
										<p className="text-xs opacity-70 italic">Speedy gonzales!</p>
									</div>

									<div className="bg-white/10 p-4 rounded-xl backdrop-blur-md border-l-4 border-[#E74C3C] animate-in slide-in-from-bottom-4 fade-in duration-500 delay-300">
										<p className="text-xs font-bold uppercase opacity-60 mb-1">Longest Eval</p>
										<div className="text-3xl font-black">{longestEval.toFixed(0)} min</div>
										<p className="text-xs opacity-70 italic">We don't talk about it...</p>
									</div>

									<div className="bg-white/10 p-4 rounded-xl backdrop-blur-md border-l-4 border-[#2ECC71] animate-in slide-in-from-bottom-4 fade-in duration-500 delay-500">
										<p className="text-xs font-bold uppercase opacity-60 mb-1">Avg Duration</p>
										<div className="text-3xl font-black">{avgEvalTime} min</div>
									</div>
								</div>
							</div>
						</div>
					)}

					{/* Step 9: Quality Check */}
					{currentStep === 9 && (
						<div className="w-full h-full bg-[#16213E] text-white flex flex-col items-center p-6 animate-in slide-in-from-right duration-500 relative overflow-hidden">
							{/* Fancy Background */}
							<div className="absolute inset-0 bg-gradient-to-br from-[#1A1A2E] via-[#16213E] to-[#0F3460] z-0" />
							<div className="absolute top-0 right-0 w-full h-full opacity-20"
								style={{
									backgroundImage: 'radial-gradient(circle at 70% 20%, rgba(76, 201, 240, 0.4) 0%, transparent 40%)'
								}}
							/>

							{/* Floating Particles */}
							<div className="absolute top-10 left-10 w-4 h-4 bg-[#4CC9F0] rounded-full animate-bounce duration-[3s]" />
							<div className="absolute bottom-20 right-10 w-6 h-6 bg-[#4361EE] rounded-full animate-bounce duration-[5s] delay-700" />

							<div className="relative z-10 w-full h-full flex flex-col justify-center">
								<h2 className="text-5xl font-black uppercase tracking-tighter mb-10 text-center relative max-w-xs mx-auto">
									<span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-[#4CC9F0] to-[#4361EE] drop-shadow-sm animate-in slide-in-from-top duration-700">
										Quality<br />Control
									</span>
									<div className="absolute -inset-4 bg-white/5 blur-xl rounded-full z-0" />
								</h2>

								<div className="grid grid-cols-1 gap-6 w-full max-w-xs mx-auto">
									<div className="group bg-white/5 backdrop-blur-md p-6 rounded-3xl border border-white/10 hover:bg-white/10 transition-all duration-300 hover:scale-105 border-l-4 border-l-[#4CC9F0]">
										<div className="text-6xl font-black mb-2 bg-clip-text text-transparent bg-gradient-to-br from-white to-gray-400 group-hover:scale-110 transition-transform origin-left">
											{outstandingCount}
										</div>
										<div className="text-sm font-bold uppercase tracking-widest text-[#4CC9F0] opacity-80 animate-pulse">
											Outstanding
										</div>
										<div className="text-[10px] mt-1 opacity-50 font-mono">
											Projects &gt; 100%
										</div>
									</div>

									<div className="flex gap-4">
										<div className="flex-1 bg-white/5 backdrop-blur-md p-4 rounded-3xl border border-white/10 border-l-4 border-l-[#4361EE] hover:-translate-y-1 transition-transform">
											<div className="text-3xl font-black mb-1 text-white">
												{leakFreeRate}%
											</div>
											<div className="text-[10px] font-bold uppercase text-[#4361EE] tracking-wider">
												Clean Code
											</div>
										</div>
										<div className="flex-1 bg-white/5 backdrop-blur-md p-4 rounded-3xl border border-white/10 border-l-4 border-l-[#F72585] hover:-translate-y-1 transition-transform delay-100">
											<div className="text-lg font-black mb-1 truncate text-white leading-8">
												{mostCommonFlag}
											</div>
											<div className="text-[10px] font-bold uppercase text-[#F72585] tracking-wider">
												Top Flag
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					)}

					{/* Step 10: Peer Wrapped */}
					{currentStep === 10 && (
						<div className="w-full h-full bg-[#240046] text-white flex flex-col items-center p-6 animate-in slide-in-from-right duration-500 relative overflow-hidden">
							{/* Background */}
							<div className="absolute inset-0 z-0">
								<div className="absolute inset-0 bg-gradient-to-b from-[#3c096c] to-[#10002b]" />
								<div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-[#5a189a]/30 to-transparent" />
							</div>

							<div className="relative z-10 w-full h-full flex flex-col justify-center">
								<h2 className="text-5xl font-black uppercase tracking-tighter mb-8 text-center leading-none drop-shadow-[0_4px_0_rgba(0,0,0,1)] animate-in zoom-in duration-500">
									Peer<br />
									<span className="text-[#e0aaff]">Review</span>
								</h2>

								{/* Main Stats Card */}
								<div className="bg-[#e0aaff] text-[#240046] p-6 rounded-3xl shadow-[8px_8px_0px_rgba(0,0,0,0.5)] mb-6 transform -rotate-1 hover:rotate-0 transition-transform duration-300">
									<div className="flex items-center gap-4 mb-2">
										<div className="text-6xl font-black">{avgPeerRating}</div>
										<div className="flex flex-col">
											<div className="flex text-[#ffce00] text-xl">
												{'★'.repeat(Math.round(Number(avgPeerRating) || 0))}
											</div>
											<div className="text-xs font-bold uppercase tracking-widest leading-tight opacity-70">
												Avg Rating
											</div>
										</div>
									</div>
									<p className="font-bold italic text-sm opacity-90 border-t border-[#240046]/20 pt-2 mt-2">
										{Number(avgPeerRating) > 4.5 ? '"Certified Legend."' : '"Solid contributor."'}
									</p>
								</div>

								{/* Top Evaluators List */}
								<div className="w-full mb-6">
									<p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-3 ml-2">Frequent Guests</p>
									<div className="space-y-2">
										{topEvaluators.map((ev, i) => (
											<div key={ev.name} className="flex items-center justify-between bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/5 animate-in slide-in-from-left fade-in duration-500" style={{ animationDelay: `${i * 150}ms` }}>
												<div className="flex items-center gap-3">
													<div className="w-6 h-6 rounded-full bg-[#e0aaff] text-[#240046] flex items-center justify-center font-bold text-xs shadow-sm">
														{i + 1}
													</div>
													<span className="font-bold text-sm tracking-wide">{ev.name}</span>
												</div>
												<span className="text-xs font-mono opacity-50">{ev.count}x</span>
											</div>
										))}
										{topEvaluators.length === 0 && (
											<div className="p-4 text-center text-sm opacity-50 italic">No evaluations yet</div>
										)}
									</div>
								</div>

								{/* Nicest Feedback */}
								{nicestFeedback && (
									<div className="bg-[#240046]/50 p-4 rounded-xl border border-[#e0aaff]/30 backdrop-blur-sm relative mt-auto max-h-[120px] overflow-hidden">
										<div className="absolute -top-3 -right-2 text-2xl rotate-12 animate-pulse">❤️</div>
										<p className="text-[10px] font-bold text-[#e0aaff] uppercase mb-1">Highlight</p>
										<p className="text-xs italic leading-relaxed opacity-90 line-clamp-3">"{nicestFeedback.feedback}"</p>
									</div>
								)}
							</div>
						</div>
					)}

					{/* Step 11: Identity Stats (The 42 DNA) - was Step 12/8 */}
					{currentStep === 11 && (
						<div className="w-full h-full bg-[#1db954] text-black flex flex-col items-center p-6 animate-in slide-in-from-right duration-500 relative overflow-hidden">
							{/* Pattern BG */}
							<div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

							<div className="relative z-10 w-full h-full flex flex-col justify-center gap-6">
								<div className="text-center">
									<h2 className="text-5xl font-black tracking-tighter text-black inline-block border-b-4 border-black pb-2">
										THE 42 DNA
									</h2>
								</div>

								<div className="grid grid-cols-2 gap-4">
									{/* Campus */}
									<div className="bg-black text-[#1db954] p-5 rounded-2xl flex flex-col aspect-square justify-between group hover:scale-105 transition-transform">
										<div className="text-xs font-bold uppercase tracking-widest text-[#1db954]/70">Campus</div>
										<div className="text-2xl font-black break-words leading-tight">
											{user.campus?.[0]?.name || "42"}
										</div>
										<div className="w-8 h-8 rounded-full bg-[#1db954] text-black flex items-center justify-center font-bold">
											C
										</div>
									</div>

									{/* Wallet */}
									<div className="bg-white text-black p-5 rounded-2xl flex flex-col aspect-square justify-between border-2 border-black group hover:scale-105 transition-transform">
										<div className="text-xs font-bold uppercase tracking-widest opacity-60">Wallet</div>
										<div className="text-5xl font-black">
											{user.wallet}
											<span className="text-lg align-top">₳</span>
										</div>
										<div className="text-xs font-bold">Manage it wisely</div>
									</div>

									{/* Eval Points */}
									<div className="bg-[#191414] text-white p-5 rounded-2xl flex flex-col aspect-square justify-between group hover:scale-105 transition-transform">
										<div className="text-xs font-bold uppercase tracking-widest opacity-60">Eval Points</div>
										<div className="text-5xl font-black text-[#FFD700] drop-shadow-lg">
											{user.correction_point}
										</div>
									</div>

									{/* Pool Year */}
									<div className="bg-[#535353] text-white p-5 rounded-2xl flex flex-col aspect-square justify-between border-2 border-black group hover:scale-105 transition-transform">
										<div className="text-xs font-bold uppercase tracking-widest opacity-80">Pool</div>
										<div>
											<div className="text-xl font-bold capitalize">{user.pool_month}</div>
											<div className="text-4xl font-black">{user.pool_year}</div>
										</div>
									</div>
								</div>

								<div className="bg-black/10 backdrop-blur-sm p-4 rounded-xl border-2 border-black/10 mt-2">
									<div className="flex justify-between items-center">
										<span className="font-bold text-sm uppercase">Current Level</span>
										<span className="font-mono font-black text-2xl">
											{activeCursus.level?.toFixed(2) || "0.00"}
										</span>
									</div>
									<div className="w-full h-3 bg-white/50 rounded-full mt-2 overflow-hidden border border-black/10">
										<div
											className="h-full bg-black"
											style={{ width: `${(activeCursus.level % 1) * 100}%` }}
										/>
									</div>
								</div>
							</div>
						</div>
					)}
					{/* Step 12: Final Summary Card - was Step 9/13 */}
					{currentStep === 12 && (
						<div className="w-full h-full bg-[#121212] text-white flex flex-col items-center p-6 animate-in slide-in-from-right duration-500 relative overflow-hidden">
							<div
								id="summary-card"
								className="w-full h-full flex flex-col bg-gradient-to-br from-[#1e1e1e] to-[#000] rounded-2xl p-6 relative"
							>
								{/* Decorative Background */}
								<div className="absolute inset-0 z-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

								{/* Header */}
								<div className="relative z-10 flex items-center gap-4 mb-4">
									<div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white shadow-lg shrink-0">
										{user.image?.link ? (
											<img src={user.image.link} alt={user.login} className="w-full h-full object-cover" />
										) : (
											<div className="w-full h-full bg-gray-900 flex items-center justify-center text-xl font-black">
												{user.login?.[0]?.toUpperCase()}
											</div>
										)}
									</div>
									<div className="min-w-0">
										<h2 className="text-2xl font-black tracking-tighter leading-none text-white truncate">
											{user.displayname || user.login}
										</h2>
										<p className="font-mono text-xs opacity-60">@{user.login}</p>
									</div>
									<div className="ml-auto">
										<div className="bg-[#FFE600] text-black font-black text-[10px] px-2 py-1 rounded rotate-3 shadow-[2px_2px_0px_white]">
											#2025
										</div>
									</div>
								</div>

								{/* VERDICT BANNER (New) */}
								<div className="relative z-10 w-full bg-gradient-to-r from-[#F1C40F] to-[#E67E22] text-black p-4 rounded-xl mb-4 shadow-lg transform hover:scale-[1.02] transition-transform">
									<div className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">The Verdict</div>
									<div className="text-2xl font-black leading-tight uppercase tracking-tight">
										{personality}
									</div>
									<div className="text-xs font-bold opacity-80 mt-1 leading-tight">
										{personalityDesc}
									</div>
									<div className="absolute right-2 top-2 opacity-20 text-4xl">👑</div>
								</div>

								{/* Stats Grid - Compacted */}
								<div className="relative z-10 grid grid-cols-2 gap-3 flex-1 overflow-hidden">
									{/* Top Projects */}
									<div className="bg-[#E91E63] p-3 rounded-xl text-white flex flex-col justify-between shadow-lg">
										<div className="text-[10px] font-bold uppercase opacity-80">Top Projects</div>
										<div>
											<div className="text-3xl font-black">{totalProjects}</div>
											<div className="text-[10px] leading-tight opacity-90 mt-0.5">
												Best: {topProjects[0]?.final_mark || 0}%
											</div>
										</div>
									</div>

									{/* Corrected Time Stats (Compact) */}
									<div className="bg-[#3498DB] p-3 rounded-xl text-white flex flex-col justify-between shadow-lg">
										<div className="text-[10px] font-bold uppercase opacity-80">Tracked</div>
										<div>
											<div className="text-xl font-black">{formatDuration(totalLogMinutes)}</div>
											<div className="text-[10px] opacity-80 mt-1">
												Avg {formatDuration(avgLogMinutes)}/day
											</div>
										</div>
									</div>

									{/* Skills */}
									<div className="bg-[#9B59B6] p-3 rounded-xl text-white flex flex-col justify-between shadow-lg col-span-2">
										<div className="flex justify-between items-center">
											<div className="text-[10px] font-bold uppercase opacity-80">Top Skill</div>
											<div className="text-[10px] font-bold bg-black/20 px-2 py-0.5 rounded">
												Lvl {activeCursus.level?.toFixed(2)}
											</div>
										</div>
										<div className="text-2xl font-black mt-1 truncate">{topSkills[0]?.name || "N/A"}</div>
									</div>

									{/* Achievements */}
									<div className="bg-[#2ECC71] p-3 rounded-xl text-black flex flex-col justify-between shadow-lg">
										<div className="text-[10px] font-bold uppercase opacity-70">Unlocks</div>
										<div className="text-3xl font-black">{achievementsFiltered.length}</div>
									</div>

									{/* Peer Rating (Replaced Bonus) */}
									<div className="bg-[#F1C40F] p-3 rounded-xl text-black flex flex-col justify-between shadow-lg">
										<div className="text-[10px] font-bold uppercase opacity-70">Peer Rtg</div>
										<div className="text-3xl font-black">{avgPeerRating} <span className="text-sm">★</span></div>
									</div>
								</div>

								{/* Footer */}
								<div className="relative z-10 mt-4 text-center">
									<p className="text-[10px] font-mono opacity-50 mb-1 tracking-widest">42wrapped.up.railway.app</p>
									<div className="font-black text-2xl tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-400 to-white opacity-20 uppercase">
										42 Wrapped
									</div>
								</div>
							</div>

							{/* Download Button (Overlay) */}
							<button
								onClick={async () => {
									const node = document.getElementById('summary-card');
									if (node) {
										try {
											// Dynamic import to avoid SSR issues if any, though here it's client side
											const { toPng } = await import('html-to-image');
											const dataUrl = await toPng(node, { skipFonts: true });
											const link = document.createElement('a');
											link.download = `42wrapped-${user.login}-2025.png`;
											link.href = dataUrl;
											link.click();
										} catch (err) {
											console.error('Failed to download image', err);
										}
									}
								}}
								className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white text-black font-bold px-6 py-3 rounded-full flex items-center gap-2 shadow-xl hover:scale-105 active:scale-95 transition-transform cursor-pointer"
							>
								<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
									<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
									<polyline points="7 10 12 15 17 10" />
									<line x1="12" y1="15" x2="12" y2="3" />
								</svg>
								Save as Image
							</button>
						</div>
					)}
				</div>
			</div>

			<MusicPlayerWidget />
		</div>
	);
}
