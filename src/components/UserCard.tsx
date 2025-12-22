import { cn } from "../lib/utils";

interface UserCardProps {
	user: {
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
			"relative group overflow-hidden bg-background p-8 border-[3px] border-primary transition-all hover:scale-105 shadow-[8px_8px_0px_0px_var(--color-primary)]",
			className
		)}>
			{/* Decorative Pattern Background */}
			<div className="absolute inset-0 opacity-10" style={{
				backgroundImage: `radial-gradient(var(--color-primary) 2px, transparent 2px)`,
				backgroundSize: '24px 24px'
			}} />

			<div className="relative z-10 flex flex-col items-center gap-6 text-center">
				<div className="relative">
					<div className="absolute inset-0 rounded-full bg-primary blur-md opacity-20 group-hover:opacity-40 transition-opacity" />
					<img
						src={user.image.link}
						alt={user.displayname}
						className="relative h-32 w-32 rounded-full border-4 border-foreground object-cover shadow-xl grayscale group-hover:grayscale-0 transition-all duration-500"
					/>
				</div>

				<div className="space-y-1">
					<h2 className="text-4xl font-black tracking-tighter text-primary uppercase font-spotify">
						{user.displayname}
					</h2>
					<p className="text-xl font-bold text-foreground font-spotify">@{user.login}</p>
				</div>

				<div className="mt-4 flex gap-3">
					<span className="inline-flex items-center border-2 border-foreground px-4 py-1.5 text-xs font-bold text-foreground uppercase tracking-widest bg-background">
						42 Student
					</span>
					<span className="inline-flex items-center bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground uppercase tracking-widest">
						Active
					</span>
				</div>
			</div>
		</div>
	);
}
