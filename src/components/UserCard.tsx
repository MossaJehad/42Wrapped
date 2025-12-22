import { cn } from "../lib/utils";

interface UserCardProps {
	user: {
		id: number;
		displayname: string;
		image: {
			link: string;
		};
		login: string;
	};
	className?: string;
}

export function UserCard({ user, className }: UserCardProps) {
	return (
		<div className={cn(
			"relative w-full max-w-sm bg-black border-4 border-white p-0 shadow-[10px_10px_0px_0px_var(--neon-green)] transition-transform hover:translate-x-1 hover:translate-y-1 hover:shadow-[5px_5px_0px_0px_var(--neon-green)]",
			className
		)}>
			{/* Scanlines Overlay */}
			<div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-20 bg-[length:100%_2px,3px_100%] pointer-events-none" />

			<div className="relative z-10 flex flex-col items-center text-center p-6 bg-black">
				<div className="w-full flex justify-between items-center mb-6 border-b-2 border-white/20 pb-2">
					<span className="text-xs font-mono text-[var(--neon-green)]">SUBJ: {user.id}</span>
					<span className="text-xs font-mono text-white">STATUS: ACTIVE</span>
				</div>

				<div className="relative mb-6 group">
					<img
						src={user.image.link}
						alt={user.displayname}
						className="relative h-48 w-48 grayscale contrast-125 brightness-110 border-2 border-white object-cover"
					/>
					<div className="absolute inset-0 border-2 border-[var(--neon-green)] translate-x-1 translate-y-1 mix-blend-difference pointer-events-none" />
				</div>

				<div className="w-full bg-white text-black p-2 mb-4 transform -skew-x-6">
					<h2 className="text-4xl font-black italic tracking-tighter uppercase transform skew-x-6 font-anton">
						{user.displayname}
					</h2>
				</div>

				<p className="text-2xl text-[var(--neon-green)] font-black tracking-widest uppercase mb-6 font-anton">
					@{user.login}
				</p>

				<div className="w-full mt-2 pt-4 border-t-2 border-dashed border-white/30">
					{/* CSS Barcode */}
					<div className="h-8 w-full bg-white"
						style={{
							maskImage: 'linear-gradient(90deg, transparent 0%, #000 10%, #000 90%, transparent 100%)',
							backgroundImage: 'repeating-linear-gradient(90deg, #000 0px, #000 2px, transparent 2px, transparent 5px, #000 5px, #000 6px, transparent 6px, transparent 10px)'
						}}
					/>
					<p className="text-[10px] text-center font-mono mt-1 tracking-[0.5em] text-white/50">42-WRAPPED-2025</p>
				</div>
			</div>
		</div>
	);
}
