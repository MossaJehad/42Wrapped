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
			"relative group overflow-hidden rounded-2xl bg-white/10 p-8 backdrop-blur-xl border border-white/20 shadow-2xl transition-all hover:scale-105 hover:bg-white/15",
			className
		)}>
			<div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

			<div className="relative z-10 flex flex-col items-center gap-6 text-center">
				<div className="relative">
					<div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 blur-lg opacity-70 group-hover:opacity-100 transition-opacity" />
					<img
						src={user.image.link}
						alt={user.displayname}
						className="relative h-32 w-32 rounded-full border-4 border-white/30 object-cover shadow-lg"
					/>
				</div>

				<div className="space-y-2">
					<h2 className="text-3xl font-bold tracking-tight text-white drop-shadow-sm">
						{user.displayname}
					</h2>
					<p className="text-lg font-medium text-white/60">@{user.login}</p>
				</div>

				<div className="mt-4 flex gap-3">
					<span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80 ring-1 ring-inset ring-white/20">
						42 Student
					</span>
					<span className="inline-flex items-center rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400 ring-1 ring-inset ring-green-500/20">
						Active
					</span>
				</div>
			</div>
		</div>
	);
}
