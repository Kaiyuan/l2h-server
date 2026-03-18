async function test() {
    const baseURL = 'http://localhost:52331';
    
    console.log('--- Testing Login ---');
    try {
        const loginResp = await fetch(`${baseURL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'l2hadmin', password: 'l2hpassword' })
        });
        const loginData = await loginResp.json() as any;
        const token = loginData.token;
        if (!token) throw new Error('Login failed: ' + JSON.stringify(loginData));
        console.log('Login Success, Token:', token.substring(0, 20) + '...');

        console.log('\n--- Testing Protected Route (/api/user/me) with Token ---');
        const meResp = await fetch(`${baseURL}/api/user/me`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const meData = await meResp.json();
        console.log('User Config:', meData);

        console.log('\n--- Testing Protected Route without Token (Expect 401) ---');
        const unauthResp = await fetch(`${baseURL}/api/user/me`);
        console.log('Status:', unauthResp.status, 'Message:', await unauthResp.text());

        console.log('\n--- Testing Update Password ---');
        const updateResp = await fetch(`${baseURL}/api/user/update-password`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                oldPassword: 'l2hpassword',
                newPassword: 'new-secure-password'
            })
        });
        console.log('Update Status:', await updateResp.json());

        console.log('\n--- Testing Login with New Password ---');
        const newLoginResp = await fetch(`${baseURL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'l2hadmin', password: 'new-secure-password' })
        });
        const newLoginData = await newLoginResp.json() as any;
        console.log('New Login Success:', !!newLoginData.token);

        // Reset password for further tests if needed
        if (newLoginData.token) {
            const resetResp = await fetch(`${baseURL}/api/user/update-password`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${newLoginData.token}`
                },
                body: JSON.stringify({
                    oldPassword: 'new-secure-password',
                    newPassword: 'l2hpassword'
                })
            });
            console.log('Password Reset to l2hpassword Status:', await resetResp.json());
        }

    } catch (e: any) {
        console.error('Test Failed:', e.message);
    }
}

test();
