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

export const exchangeCodeForToken = createServerFn({ method: "POST" })
	.handler(async (ctx: any) => {
		const code = ctx.data;
		console.log('Exchanging code for token:', code);

		const params = new URLSearchParams();
		params.append('grant_type', 'authorization_code');
		params.append('client_id', clientConfig.clientId);
		params.append('client_secret', serverConfig.clientSecret);
		params.append('code', code);
		params.append('redirect_uri', clientConfig.redirectUri);

		const response = await fetch(clientConfig.tokenUrl, {
			method: 'POST',
			headers: {
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
		console.log('Token exchange response:', data);
		return data;
	});

export const fetchMe = createServerFn()
	.handler(async (ctx: any) => {
		const token = ctx.data;
		const response = await fetch(clientConfig.meUrl, {
			headers: {
				Authorization: `Bearer ${token}`,
			},
		});

		if (!response.ok) {
			throw new Error("Failed to fetch user profile");
		}

		const data = await response.json() as User42;
		return data;
	});
