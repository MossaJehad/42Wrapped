
import { createServerFn } from '@tanstack/react-start';
import { clientConfig } from '../lib/client-config';
import { serverConfig } from './server-config';

type TokenResponse = {
	access_token: string;
	token_type: string;
	expires_in: number;
	scope: string;
	created_at: number;
	secret_valid_until: number;
};

type User42 = {
	id: number;
	login: string;
	email: string;
	image: {
		link: string;
		versions: {
			large: string;
			medium: string;
			small: string;
			micro: string;
		};
	};
	displayname: string;
	wallet: number;
	correction_point: number;
};

// Assuming the shape of an Achievement based on standard 42 API responses
export type Achievement = {
	id: number;
	name: string;
	description: string;
	tier: string;
	kind: string;
	visible: boolean;
	image: string;
	nbr_of_success: number;
	users_url: string;
};

export type AchievementUser = {
	id: number;
	achievement_id: number;
	user_id: number;
	created_at: string;
	updated_at: string;
	achievement: Achievement;
};

const INTRA_HEADERS: HeadersInit = {
	'User-Agent':
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
	'Accept': 'application/json, text/plain, */*',
	'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
	'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
	'Sec-Ch-Ua-Mobile': '?0',
	'Sec-Ch-Ua-Platform': '"macOS"',
};

export const exchangeCodeForToken = createServerFn({ method: "POST" })
	.handler(async (ctx: any) => {
		const raw = ctx.data;
		const code = typeof raw === 'string' ? raw : raw?.code;
		const redirectUri =
			(typeof raw === 'object' && raw?.redirectUri) ||
			process.env.REDIRECT_URI ||
			process.env.VITE_REDIRECT_URI ||
			clientConfig.redirectUri;

		const params = new URLSearchParams();
		params.append('grant_type', 'authorization_code');
		params.append('client_id', clientConfig.clientId);
		params.append('client_secret', serverConfig.clientSecret);
		params.append('code', code);
		params.append('redirect_uri', redirectUri);

		const response = await fetch(clientConfig.tokenUrl, {
			method: 'POST',
			headers: {
				...INTRA_HEADERS,
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: params,
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('Token exchange failed:', response.status, errorText);
			throw new Error(`Failed to exchange token: ${response.status} ${errorText}`);
		}

		const data = await response.json() as TokenResponse;
		return data;
	});

export const fetchMe = createServerFn()
	.handler(async (ctx: any) => {
		const token = ctx.data;
		const response = await fetch(clientConfig.meUrl, {
			headers: {
				...INTRA_HEADERS,
				Authorization: `Bearer ${token}`,
			},
		});

		if (!response.ok) {
			throw new Error("Failed to fetch user profile");
		}

		const data = await response.json() as User42;
		return data;
	});

// New function to fetch achievements
export const fetchUserAchievements = createServerFn()
	.handler(async (ctx: any) => {
		const { token, userId } = ctx.data;

		// 1. Fetch user's unlocked achievements (just IDs and dates)
		const userAchUrl = `https://api.intra.42.fr/v2/achievements_users?filter[user_id]=${userId}&page[size]=100`;

		const userAchResponse = await fetch(userAchUrl, {
			headers: { ...INTRA_HEADERS, Authorization: `Bearer ${token}` },
		});

		if (!userAchResponse.ok) {
			console.error("Failed to fetch user achievements", userAchResponse.status);
			return [];
		}

		const userAchievements = await userAchResponse.json() as any[];

		// 2. Fetch ALL achievements (to get names)
		const allAchUrl = `https://api.intra.42.fr/v2/achievements?page[size]=100`;

		const allAchResponse = await fetch(allAchUrl, {
			headers: { ...INTRA_HEADERS, Authorization: `Bearer ${token}` },
		});

		if (!allAchResponse.ok) {
			console.error("Failed to fetch all achievements", allAchResponse.status);
			return [];
		}

		const allAchievements = await allAchResponse.json() as any[];

		// 3. Create a map of achievement ID -> achievement details
		const achievementMap = new Map<number, any>();
		allAchievements.forEach((ach: any) => {
			achievementMap.set(ach.id, ach);
		});

		// 4. Merge: user's unlocked achievements with their full details
		return userAchievements.map((ua: any) => {
			const details = achievementMap.get(ua.achievement_id) || {};
			return {
				id: ua.achievement_id,
				name: details.name || "Unknown",
				description: details.description,
				tier: details.tier,
				image: details.image,
				unlocked_at: ua.created_at
			};
		});
	});

export const fetchLocations = createServerFn()
	.handler(async (ctx: any) => {
		const { token, userId } = ctx.data;
		// Fetch last 4 months of locations.
		const fourMonthsAgo = new Date();
		fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);
		const dateString = fourMonthsAgo.toISOString();

		// Fetch locations since 4 months ago. Max 100 might be small for 4 months if daily user, but it's a start.
		const url = `https://api.intra.42.fr/v2/users/${userId}/locations?range[begin_at]=${dateString},2100-01-01T00:00:00.000Z&page[size]=100`;

		const response = await fetch(url, {
			headers: { ...INTRA_HEADERS, Authorization: `Bearer ${token}` },
		});

		if (!response.ok) {
			console.error("Failed to fetch locations", response.status);
			return [];
		}
		return await response.json();
	});

export const fetchScaleTeams = createServerFn()
	.handler(async (ctx: any) => {
		const { token, userId } = ctx.data;

		// Fetch both as corrected (feedback received) and as corrector (evaluations done)
		// Filter for target year to ensure relevant data within the limit
		const targetYear =
			Number(process.env.WRAPPED_YEAR || process.env.VITE_WRAPPED_YEAR) ||
			new Date().getFullYear();
		const yearStart = `${targetYear}-01-01T00:00:00.000Z`;
		const yearEnd = `${targetYear + 1}-01-01T00:00:00.000Z`;

		const [correctedRes, correctorRes] = await Promise.all([
			fetch(`https://api.intra.42.fr/v2/users/${userId}/scale_teams/as_corrected?range[begin_at]=${yearStart},${yearEnd}&page[size]=100`, {
				headers: { ...INTRA_HEADERS, Authorization: `Bearer ${token}` }
			}),
			fetch(`https://api.intra.42.fr/v2/users/${userId}/scale_teams/as_corrector?range[begin_at]=${yearStart},${yearEnd}&page[size]=100`, {
				headers: { ...INTRA_HEADERS, Authorization: `Bearer ${token}` }
			})
		]);

		const corrected = correctedRes.ok ? (await correctedRes.json()).map((e: any) => ({ ...e, is_corrector: false })) : [];
		const corrector = correctorRes.ok ? (await correctorRes.json()).map((e: any) => ({ ...e, is_corrector: true })) : [];

		// Combine them
		return [...corrected, ...corrector];
	});

export const fetchTeams = createServerFn()
	.handler(async (ctx: any) => {
		const { token, userId } = ctx.data;
		// Fetch teams for group projects
		const url = `https://api.intra.42.fr/v2/users/${userId}/teams?page[size]=100`;

		const response = await fetch(url, {
			headers: { ...INTRA_HEADERS, Authorization: `Bearer ${token}` },
		});

		if (!response.ok) {
			console.error("Failed to fetch teams", response.status);
			return [];
		}

		const teams = await response.json();

		// Enrich with user images (bulk fetch)
		try {
			const userIds = new Set<number>();
			teams.forEach((t: any) => {
				// Only gather IDs for relevant teams (e.g. 2025/2024) to save bandwidth,
				// or just take the first X users found.
				// Let's filter for teams updated recently (last 12 months)
				// Or simply take all from the 100 teams fetched.
				t.users?.forEach((u: any) => userIds.add(u.id));
			});

			if (userIds.size > 0 && userIds.size < 150) { // Limit to avoid URL overflow
				const idList = Array.from(userIds).join(',');
				const usersUrl = `https://api.intra.42.fr/v2/users?filter[id]=${idList}&page[size]=100`;
				const usersRes = await fetch(usersUrl, {
					headers: { ...INTRA_HEADERS, Authorization: `Bearer ${token}` },
				});

				if (usersRes.ok) {
					const usersData = await usersRes.json() as any[];
					const userMap = new Map(usersData.map((u: any) => [u.id, u]));

					// Map images back to teams
					teams.forEach((t: any) => {
						if (t.users) {
							t.users = t.users.map((u: any) => {
								const fullUser = userMap.get(u.id);
								return fullUser ? { ...u, image: fullUser.image } : u;
							});
						}
					});
				}
			}
		} catch (err) {
			console.error("Failed to enrich teams with images", err);
		}

		return teams;
	});






