
import { useState, useEffect, useCallback } from 'react';
import { cn } from '../lib/utils';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface StoryModeProps {
	user: any;
	achievements?: any[];
	onClose?: () => void;
}

export function StoryMode({ user, achievements = [], onClose }: StoryModeProps) {
	const [currentStep, setCurrentStep] = useState(0);
	const [isPaused, setIsPaused] = useState(false);

	// --- Data Processing for 2025 ---
	const currentYear = 2025;
	const totalSteps = 4; // Intro, Achievements, Projects, Skills

	// 1. Projects
	const projects = user.projects_users || [];
	const projects2025 = projects.filter((p: any) => {
		if (!p.marked_at) return false;
		return new Date(p.marked_at).getFullYear() === currentYear && p.status === 'finished';
	});

	const topProjects = [...projects2025].sort((a: any, b: any) => b.final_mark - a.final_mark);
	const totalProjects = projects2025.length;
	const averageMark = totalProjects > 0
		? Math.round(projects2025.reduce((acc: number, curr: any) => acc + (curr.final_mark || 0), 0) / totalProjects)
		: 0;

	// 2. Skills
	const cursusUsers = user.cursus_users || [];
	const activeCursus = cursusUsers.find((cu: any) => cu.skills && cu.skills.length > 0) || cursusUsers[0];
	const skills = activeCursus?.skills || [];
	const topSkills = [...skills].sort((a: any, b: any) => b.level - a.level).slice(0, 5);

	// 3. Achievements
	const sourceAchievements = (achievements && achievements.length > 0) ? achievements : (user.achievements || []);

	const achievementsFiltered = sourceAchievements.map((ach: any) => {
		// Try to resolve name if missing (common when fetching from achievements_users endpoint)
		let resolvedName = ach.name;
		if (!resolvedName && user.achievements) {
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
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
			{/* Controls: Pause/Play & Close */}
			<div className="absolute top-4 right-4 z-[60] flex items-center gap-2">
				<button
					onClick={() => setIsPaused(!isPaused)}
					className="p-2 bg-white/10 backdrop-blur-md rounded-full text-white/50 hover:text-white hover:bg-white/20 transition"
					title={isPaused ? "Play" : "Pause"}
				>
					{isPaused ? (
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
					) : (
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
					)}
				</button>

				<button
					onClick={onClose}
					className="p-2 bg-white/10 backdrop-blur-md rounded-full text-white/50 hover:text-white hover:bg-white/20 transition"
				>
					<X size={24} />
				</button>
			</div>

			{/* Navigation Buttons (Desktop) */}
			<button
				onClick={prevStep}
				disabled={currentStep === 0}
				className="hidden md:flex absolute left-8 top-1/2 -translate-y-1/2 z-50 text-white/50 hover:text-white transition disabled:opacity-0"
			>
				<ChevronLeft size={48} />
			</button>

			<button
				onClick={nextStep}
				disabled={currentStep === totalSteps - 1}
				className="hidden md:flex absolute right-8 top-1/2 -translate-y-1/2 z-50 text-white/50 hover:text-white transition disabled:opacity-0"
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
									"h-full bg-white transition-all duration-300 ease-linear",
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

				{/* Story Content */}
				<div className="w-full h-full relative">

					{/* Slide 1: User Profile */}
					{currentStep === 0 && (
						<div className="w-full h-full bg-gradient-to-br from-purple-900 to-black flex flex-col items-center justify-center p-8 animate-in fade-in duration-300">
							<div className="relative mb-8">
								<div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-primary overflow-hidden shadow-[0_0_40px_-10px_var(--color-primary)]">
									{user.image?.link ? (
										<img src={user.image.link} alt={user.login} className="w-full h-full object-cover" />
									) : (
										<div className="w-full h-full bg-gray-700 flex items-center justify-center text-4xl font-bold">
											{user.login?.[0]?.toUpperCase()}
										</div>
									)}
								</div>
								<div className="absolute -bottom-2 -right-2 bg-primary text-black font-black px-3 py-1 rounded-full text-sm">
									#STUDENT
								</div>
							</div>

							<h2 className="text-4xl font-black text-white text-center mb-2 tracking-tighter">
								{user.displayname}
							</h2>
							<p className="text-xl text-white/70 text-center font-mono">
								@{user.login}
							</p>

							<div className="mt-12 bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/10 w-full">
								<p className="text-center text-white/90 font-medium">
									Ready to unwrap your 2025?
								</p>
							</div>
						</div>
					)}

					{/* Slide 2: Achievements - "Top List" Style */}
					{currentStep === 1 && (
						<div className="w-full h-full bg-[#121212] text-white flex flex-col relative overflow-hidden p-6 font-sans">
							{/* Decorative Top-Left Corners */}
							<div className="absolute -top-10 -left-10 z-0">
								<div className="w-40 h-40 rounded-full border-[20px] border-[#9b5de5] absolute top-0 left-0" />
								<div className="w-56 h-56 rounded-full border-[20px] border-[#f15bb5] absolute top-[-30px] left-[-30px]" />
								<div className="w-72 h-72 rounded-full border-[20px] border-[#fee440] absolute top-[-60px] left-[-60px]" />
							</div>

							{/* Decorative Bottom-Right Corners */}
							<div className="absolute -bottom-20 -right-20 z-0 opacity-80">
								<div className="w-64 h-64 rounded-full border-[30px] border-[#00bbf9] absolute bottom-0 right-0" />
								<div className="w-80 h-80 rounded-full border-[30px] border-[#9b5de5] absolute bottom-[-40px] right-[-40px]" />
							</div>

							{/* Scribble Line (SVG) */}
							<svg className="absolute top-32 right-0 w-48 h-48 z-0 opacity-60" viewBox="0 0 100 100" fill="none" stroke="white" strokeWidth="2">
								<path d="M10,50 Q30,10 50,50 T90,50" />
							</svg>

							<div className="relative z-10 w-full h-full flex flex-col">
								{/* Title */}
								<div className="self-center mt-20 md:mt-10 mb-8 md:mb-12">
									<div className="bg-white text-black font-black text-2xl px-4 py-2 uppercase tracking-tighter inline-block rotate-[-3deg] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)]">
										My Unlocks
									</div>
								</div>

								{/* The List 1-5 */}
								<div className="flex flex-col gap-5 w-full max-w-xs mx-auto">
									{displayAchievements.map((ach: any, idx: number) => (
										<div key={ach.id} className="flex items-center gap-4 group">
											{/* Number */}
											<span className="font-black text-4xl w-8 text-right text-white tabular-nums tracking-tighter shrink-0 drop-shadow-lg">
												{idx + 1}
											</span>

											{/* Name Box */}
											<div className="bg-white text-black font-black text-sm md:text-base px-3 py-2 uppercase tracking-tight w-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform transition group-hover:scale-105 group-hover:-rotate-1 truncate">
												{ach.name}
											</div>
										</div>
									))}

									{displayAchievements.length === 0 && (
										<div className="text-center opacity-60 mt-10 font-bold tracking-widest uppercase">
											No 2025 Unlocks
										</div>
									)}
								</div>

								{/* Count Summary */}
								<div className="mt-auto mb-12 self-end text-right">
									<p className="text-[#00bbf9] font-black text-6xl tracking-tighter leading-none drop-shadow-md">
										{achievementsFiltered.length}
									</p>
									<p className="text-white font-bold text-sm uppercase tracking-widest bg-black/50 px-2 inline-block">
										Total in 2025
									</p>
								</div>
							</div>
						</div>
					)}

					{/* Slide 3: Projects 2025 Card */}
					{currentStep === 2 && (
						<div className="w-full h-full bg-[#8e44ad] text-white flex flex-col items-center p-8 animate-in slide-in-from-right duration-300 relative overflow-hidden">
							{/* Decoration */}
							<div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse" />
							<div className="absolute bottom-10 -left-10 w-48 h-48 bg-black/20 rounded-full blur-3xl" />

							<div className="relative z-10 w-full flex-1 flex flex-col justify-center">
								<h2 className="text-5xl font-black tracking-tighter mb-8 text-center rotate-1">
									CODING
									<br />
									MARATHON
								</h2>

								<div className="grid grid-cols-2 gap-4 mb-8">
									<div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10 text-center">
										<div className="text-4xl font-black mb-1">{totalProjects}</div>
										<div className="text-[10px] uppercase font-bold tracking-widest opacity-70">
											Projects Done
										</div>
									</div>
									<div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10 text-center">
										<div className="text-4xl font-black mb-1">{averageMark}%</div>
										<div className="text-[10px] uppercase font-bold tracking-widest opacity-70">
											Avg Score
										</div>
									</div>
								</div>

								<div className="space-y-3 w-full">
									<p className="text-center font-bold text-sm uppercase tracking-widest opacity-70 mb-2">
										Top Projects
									</p>
									{topProjects.slice(0, 3).map((p: any) => (
										<div key={p.id} className="flex items-center justify-between bg-black/20 p-3 rounded-lg border border-white/5">
											<span className="font-bold text-sm truncate max-w-[150px]">{p.project.name}</span>
											<span className={`font-black ${p.final_mark >= 100 ? 'text-[#1DB954]' : 'text-white'}`}>
												{p.final_mark}
											</span>
										</div>
									))}
								</div>

								{topProjects.length === 0 && (
									<div className="text-center opacity-70 font-medium">
										No projects finished in {currentYear}.
									</div>
								)}
							</div>
						</div>
					)}

					{/* Slide 4: Skills Card */}
					{currentStep === 3 && (
						<div className="w-full h-full bg-[#FF4785] text-white flex flex-col items-center p-8 animate-in slide-in-from-right duration-300 relative overflow-hidden">
							<div className="relative z-10 w-full flex-1 flex flex-col justify-center">
								<h2 className="text-5xl font-black tracking-tighter mb-8 text-center -rotate-1">
									TOP
									<br />
									SKILLS
								</h2>

								<div className="w-full space-y-4">
									{topSkills.map((skill: any, index: number) => (
										<div key={skill.id} className="w-full">
											<div className="flex justify-between mb-1 text-sm font-bold uppercase tracking-wider">
												<span>{skill.name}</span>
												<span className="opacity-80">{skill.level.toFixed(2)}</span>
											</div>
											<div className="h-3 w-full bg-black/20 rounded-full overflow-hidden">
												<div
													className="h-full bg-white rounded-full"
													style={{
														width: `${Math.min((skill.level / 21) * 100, 100)}%`, // Assuming 21 is max level for visual scale roughly
														transitionDelay: `${index * 100}ms`
													}}
												/>
											</div>
										</div>
									))}
								</div>

								{topSkills.length === 0 && (
									<div className="text-center opacity-70 font-medium">
										No skill data available yet.
									</div>
								)}
							</div>
						</div>
					)}

				</div>
			</div>
		</div>
	);
}
