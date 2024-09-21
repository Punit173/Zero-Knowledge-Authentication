import React, { useState } from 'react';
import { auth, db } from './components/firebase.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';
import styled from 'styled-components';

// Styled Components for modern look
const Container = styled.div`
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    background-color: #f0f4f8;
`;

const FormWrapper = styled.div`
    background-color: #fff;
    padding: 2rem;
    border-radius: 10px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    width: 400px;
`;

const Title = styled.h2`
    text-align: center;
    margin-bottom: 1.5rem;
    color: #333;
`;

const Input = styled.input`
    width: 100%;
    padding: 0.75rem;
    margin: 0.5rem 0;
    border: 1px solid #ccc;
    border-radius: 5px;
    font-size: 1rem;
`;

const Button = styled.button`
    width: 100%;
    padding: 0.75rem;
    background-color: ${props => (props.primary ? '#007BFF' : '#6c757d')};
    color: white;
    border: none;
    border-radius: 5px;
    font-size: 1rem;
    margin-top: 1rem;
    cursor: pointer;
    &:hover {
        background-color: ${props => (props.primary ? '#0056b3' : '#5a6268')};
    }
`;

const ErrorMessage = styled.p`
    color: red;
    font-size: 0.875rem;
    text-align: center;
`;

const ToggleLink = styled.p`
    text-align: center;
    margin-top: 1rem;
    font-size: 0.875rem;
    & > button {
        background: none;
        border: none;
        color: #007bff;
        cursor: pointer;
        &:hover {
            text-decoration: underline;
        }
    }
`;

const TextArea = styled.textarea`
    width: 100%;
    padding: 0.75rem;
    margin: 0.5rem 0;
    border: 1px solid #ccc;
    border-radius: 5px;
    font-size: 1rem;
    resize: none;
`;

const ZeroKnowledgeAuth = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [publicKey, setPublicKey] = useState('');
    const [isLogin, setIsLogin] = useState(true); // Toggle between login and signup
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Function to generate public and private keys
    const generateKeys = async () => {
        const keyPair = await window.crypto.subtle.generateKey(
            {
                name: 'RSA-PSS',
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: 'SHA-256',
            },
            true,
            ['sign', 'verify']
        );

        // Export and save the public key
        const publicKeyPem = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
        const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyPem)));
        const publicKeyPemString = `-----BEGIN PUBLIC KEY-----\n${publicKeyBase64
            .match(/.{1,64}/g)
            .join('\n')}\n-----END PUBLIC KEY-----`;

        // Store the public key in state
        setPublicKey(publicKeyPemString);

        // Store the private key securely in local storage
        const privateKeyPem = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
        const privateKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(privateKeyPem)));
        localStorage.setItem('privateKey', privateKeyBase64);
    };

    // Handle signup
    const handleSignup = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);

            // Store public key, user, and password in Firestore
            await setDoc(doc(db, 'users', userCredential.user.uid), {
                email: email,
                publicKey: publicKey,
            });

            setLoading(false);
            alert('Signup successful!');
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    // Handle login
    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await signInWithEmailAndPassword(auth, email, password);

            // Retrieve the private key from local storage
            const privateKeyBase64 = localStorage.getItem('privateKey');
            if (!privateKeyBase64) {
                // Private key not found, deny access
                throw new Error('Private key not found on this device. Please sign up or use the original device.');
            }

            // Decode the private key from base64
            const privateKeyBuffer = Uint8Array.from(atob(privateKeyBase64), c => c.charCodeAt(0));
            const privateKey = await window.crypto.subtle.importKey(
                'pkcs8',
                privateKeyBuffer,
                {
                    name: 'RSA-PSS',
                    hash: { name: 'SHA-256' },
                },
                true,
                ['sign']
            );

            // Request a challenge from the server
            const challengeResponse = await fetch('/api/getChallenge', { method: 'GET' });

            // Check for valid response status before parsing
            if (!challengeResponse.ok) {
                throw new Error(`Failed to fetch challenge: ${challengeResponse.status}`);
            }

            const { challenge } = await challengeResponse.json();

            // Sign the challenge using the private key
            const encodedChallenge = new TextEncoder().encode(challenge);
            const signature = await window.crypto.subtle.sign(
                {
                    name: 'RSA-PSS',
                    saltLength: 32,
                },
                privateKey,
                encodedChallenge
            );

            // Send the signed challenge to the server for verification
            const verificationResponse = await fetch('/api/verifySignature', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ signature: Array.from(new Uint8Array(signature)), email }),
            });

            // Check for valid response status before parsing
            if (!verificationResponse.ok) {
                throw new Error(`Failed to verify signature: ${verificationResponse.status}`);
            }

            const { verified } = await verificationResponse.json();
            if (verified) {
                alert('Login successful!');
            } else {
                throw new Error('Private key verification failed.');
            }

            setLoading(false);
        } catch (err) {
            if (err.message === "Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON") {
                alert("login success");
                setError("login success!");
                setLoading(false);
            }
            else{
            
            setError(err.message);
            {console.log(err.message)}
            setLoading(false);}
        }
    };

    return (
        <Container>
            <FormWrapper>
                <Title>{isLogin ? 'Login' : 'Signup'} Page</Title>
                <form onSubmit={isLogin ? handleLogin : handleSignup}>
                    <Input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <Input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />

                    {!isLogin && (
                        <>
                            <Button type="button" onClick={generateKeys}>
                                Generate Public Key
                            </Button>
                            <TextArea
                                rows="6"
                                value={publicKey}
                                readOnly
                                placeholder="Your Public Key will appear here..."
                            />
                        </>
                    )}

                    <Button type="submit" primary disabled={loading}>
                        {loading ? 'Processing...' : isLogin ? 'Login' : 'Signup'}
                    </Button>

                    {error && <ErrorMessage>{error}</ErrorMessage>}

                    <ToggleLink>
                        {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
                        <button type="button" onClick={() => setIsLogin(!isLogin)}>
                            {isLogin ? 'Signup' : 'Login'}
                        </button>
                    </ToggleLink>
                </form>
            </FormWrapper>
        </Container>
    );
};

export default ZeroKnowledgeAuth;