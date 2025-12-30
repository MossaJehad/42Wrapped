import { useState, useEffect, useRef } from 'react';
import { Music, ChevronDown, ChevronUp, Volume2, VolumeX } from 'lucide-react';
import { cn } from '../lib/utils';

const GENRE_FILES: Record<string, string> = {
	'Acoustic Indie': '/music/acoustic-indie.mp3',
	'Techno House': '/music/techno-house.mp3',
	'Chill Lofi': '/music/chill-lofi.mp3',
};

interface MusicPlayerWidgetProps {
	isPaused?: boolean;
}

export function MusicPlayerWidget({ isPaused: externalPaused = false }: MusicPlayerWidgetProps) {
	const [isOpen, setIsOpen] = useState(true);
	const [currentGenre, setCurrentGenre] = useState('Techno House');
	const [isMuted, setIsMuted] = useState(false);
	const audioRef = useRef<HTMLAudioElement | null>(null);

	useEffect(() => {
		// Initialize audio
		if (!audioRef.current) {
			audioRef.current = new Audio();
			audioRef.current.loop = true;
		}

		const audio = audioRef.current;
		audio.src = GENRE_FILES[currentGenre];
		audio.volume = 0.5; // Slightly increased volume
		audio.muted = isMuted;

		const playAudio = async () => {
			try {
				await audio.play();
				console.log("Playing:", currentGenre);
			} catch (error) {
				console.log("Autoplay prevented. Waiting for interaction...", error);
				// If autoplay fails, add a one-time listener to start it on any click
				const enableAudio = () => {
					audio.play().catch(e => console.error("Still failed to play", e));
					document.removeEventListener('click', enableAudio);
					document.removeEventListener('keydown', enableAudio);
					document.removeEventListener('touchstart', enableAudio);
				};

				document.addEventListener('click', enableAudio);
				document.addEventListener('keydown', enableAudio);
				document.addEventListener('touchstart', enableAudio);
			}
		};

		playAudio();

		return () => {
			audio.pause();
		};
	}, [currentGenre]);

	useEffect(() => {
		if (audioRef.current) {
			audioRef.current.muted = isMuted;
		}
	}, [isMuted]);

	// Handle external pause/play control
	useEffect(() => {
		if (!audioRef.current) return;

		if (externalPaused) {
			audioRef.current.pause();
		} else {
			audioRef.current.play().catch(e => console.log("Could not resume audio", e));
		}
	}, [externalPaused]);

	const genres = Object.keys(GENRE_FILES);

	return (
		<div className={cn(
			"fixed bottom-6 left-6 z-[100] bg-[#000000] text-white rounded-xl overflow-hidden border border-white/10 font-sans shadow-2xl transition-all duration-300 ease-out",
			// Mobile: square when closed, full when open. Larger screens: always full width
			isOpen ? "w-72 h-auto" : "w-[52px] h-[52px] sm:w-72 sm:h-[52px]"
		)}>
			{/* Header */}
			<div
				className="flex items-center justify-between p-3.5 cursor-pointer bg-white/5 hover:bg-white/10 transition-colors"
				onClick={() => setIsOpen(!isOpen)}
			>
				<div className="flex items-center gap-2.5">
					<Music size={18} className="text-white/80" />
					<span className={cn(
						"font-bold text-sm tracking-wide",
						isOpen ? "inline" : "hidden sm:inline"
					)}>Music Player</span>
				</div>
				<div className={cn(isOpen ? "block" : "hidden sm:block")}>
					{isOpen ? <ChevronDown size={18} className="text-white/60" /> : <ChevronUp size={18} className="text-white/60" />}
				</div>
			</div>

			{/* List - Show when open */}
			<div className={cn(
				"p-2 flex-col gap-1 bg-[#000000]",
				isOpen ? "flex" : "hidden"
			)}>
				{genres.map((genre) => (
					<button
						key={genre}
						onClick={() => setCurrentGenre(genre)}
						className={cn(
							"cursor-pointer w-full text-left px-4 py-3 rounded-lg font-bold text-sm transition-all duration-200",
							currentGenre === genre
								? "bg-white/10 text-white shadow-inner"
								: "text-white/50 hover:text-white hover:bg-white/5"
						)}
					>
						{genre}
					</button>
				))}
			</div>

			{/* Footer - Show when open */}
			<div className={cn(
				"px-4 py-3 mb-1 items-center justify-between text-xs",
				isOpen ? "flex" : "hidden"
			)}>
				<div className="text-white/40 font-medium">
					Now Playing: <span className="text-white/80 ml-1">{currentGenre}</span>
				</div>
				<button
					onClick={(e) => {
						e.stopPropagation();
						setIsMuted(!isMuted);
					}}
					className="text-white/60 hover:text-white transition-colors p-1 cursor-pointer"
				>
					{isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
				</button>
			</div>
		</div>
	);
}
