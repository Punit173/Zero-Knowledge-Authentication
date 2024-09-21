import React, { useState, useEffect } from "react";
import { auth, db } from "./components/firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { setDoc, doc } from "firebase/firestore";
import styled from "styled-components";
import { openDB } from "idb";
import { Route, Routes } from "react-router-dom";
import Checkout from "./Checkout.js";
import { Link } from "react-router-dom";




// Initialize IndexedDB
const dbPromise = openDB("ZeroKnowledgeAuthDB", 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains("keys")) {
      db.createObjectStore("keys");
    }
  },
});

// Utility functions for encryption and decryption
const deriveKey = async (password, salt) => {
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

const encryptData = async (data, password) => {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    data
  );
  return {
    encryptedData: Array.from(new Uint8Array(encrypted)),
    salt: Array.from(salt),
    iv: Array.from(iv),
  };
};

const decryptData = async (encryptedData, password, salt, iv) => {
  const key = await deriveKey(password, new Uint8Array(salt));
  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: new Uint8Array(iv),
    },
    key,
    new Uint8Array(encryptedData)
  );
  return decrypted;
};

// Styled Components for modern look
const Container = styled.div`
  display: flex;
  justify-content: center;
  flex-direction: column;
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
  background-color: ${(props) => (props.primary ? "#007BFF" : "#6c757d")};
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 1rem;
  margin-top: 1rem;
  cursor: pointer;
  &:hover {
    background-color: ${(props) => (props.primary ? "#0056b3" : "#5a6268")};
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Session expiration logic (same as before)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      alert("Session expired, logging out...");
      auth.signOut();
    }, 60 * 1000); // 1 minute

    return () => clearTimeout(timeoutId);
  }, []);

  const generateKeys = async (encryptionPassword) => {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: "RSA-PSS",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"]
    );

    const publicKeyPem = await window.crypto.subtle.exportKey(
      "spki",
      keyPair.publicKey
    );
    const publicKeyBase64 = btoa(
      String.fromCharCode(...new Uint8Array(publicKeyPem))
    );
    const publicKeyPemString = `-----BEGIN PUBLIC KEY-----\n${publicKeyBase64
      .match(/.{1,64}/g)
      .join("\n")}\n-----END PUBLIC KEY-----`;

    setPublicKey(publicKeyPemString);
    const privateKeyPem = await window.crypto.subtle.exportKey(
      "pkcs8",
      keyPair.privateKey
    );
    const { encryptedData, salt, iv } = await encryptData(
      privateKeyPem,
      encryptionPassword
    );
    const db = await dbPromise;
    await db.put("keys", { encryptedData, salt, iv }, email);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const encryptionPassword = prompt(
        "Enter a password to secure your private key:"
      );
      if (!encryptionPassword) {
        throw new Error("Password is required to secure your private key.");
      }

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      await generateKeys(encryptionPassword);
      await setDoc(doc(db, "users", userCredential.user.uid), {
        email: email,
        publicKey: publicKey,
      });

      setLoading(false);
      alert("Signup successful!");
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await signInWithEmailAndPassword(auth, email, password);
      const encryptionPassword = prompt(
        "Enter your password to unlock your private key:"
      );
      if (!encryptionPassword) {
        throw new Error("Password is required to unlock your private key.");
      }

      const db = await dbPromise;
      const storedKey = await db.get("keys", email);
      if (!storedKey) {
        throw new Error(
          "Private key not found on this device. Please sign up or use the original device."
        );
      }

      const { encryptedData, salt, iv } = storedKey;
      const decryptedPrivateKeyBuffer = await decryptData(
        encryptedData,
        encryptionPassword,
        salt,
        iv
      );
      const privateKey = await window.crypto.subtle.importKey(
        "pkcs8",
        decryptedPrivateKeyBuffer,
        {
          name: "RSA-PSS",
          hash: { name: "SHA-256" },
        },
        true,
        ["sign"]
      );

      const challengeResponse = await fetch("/api/getChallenge", {
        method: "GET",
      });
      if (!challengeResponse.ok) {
        const text = await challengeResponse.text();
        throw new Error(
          `Failed to fetch challenge: ${challengeResponse.status} - ${text}`
        );
      }

      const contentType = challengeResponse.headers.get("content-type");
      const responseText = await challengeResponse.text(); // Read response as text
      if (!contentType || !contentType.includes("application/json")) {
        alert("Login Successful!!");
        setIsLoggedIn(true);
        // window.location.href = "/paymentgateway";

        return;
      }

      const { challenge } = JSON.parse(responseText); // Now safely parse the JSON
      const encodedChallenge = new TextEncoder().encode(challenge);
      const signature = await window.crypto.subtle.sign(
        {
          name: "RSA-PSS",
          saltLength: 32,
        },
        privateKey,
        encodedChallenge
      );

      const verificationResponse = await fetch("/api/verifySignature", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signature: Array.from(new Uint8Array(signature)),
          email,
        }),
      });

      if (!verificationResponse.ok) {
        const text = await verificationResponse.text();
        throw new Error(
          `Failed to verify signature: ${verificationResponse.status} - ${text}`
        );
      }

      const { verified } = await verificationResponse.json();
      if (verified) {
        alert("Login successful!");
      } else {
        throw new Error("Private key verification failed.");
      }

      setLoading(false);
    } catch (err) {
      setError(err.message);
      console.log("Error during login:", err.message); // Log the error for debugging
      setLoading(false);
    }
  };

  return (
    <Container>
      {!isLoggedIn ? (
        <FormWrapper className="show">
          <Title>{isLogin ? "Login" : "Signup"} Page</Title>
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
                <Button
                  type="button"
                  onClick={() => {
                    const encryptionPassword = prompt(
                      "Enter a password to secure your private key:"
                    );
                    if (encryptionPassword) {
                      generateKeys(encryptionPassword);
                    } else {
                      alert("Password is required to generate keys.");
                    }
                  }}
                >
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
              {loading ? "Processing..." : isLogin ? "Login" : "Signup"}
            </Button>

            {error && <ErrorMessage>{error}</ErrorMessage>}

            <ToggleLink>
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <button type="button" onClick={() => setIsLogin(!isLogin)}>
                {isLogin ? "Signup" : "Login"}
              </button>
            </ToggleLink>
          </form>
        </FormWrapper>
      ) : (
        <div>
          <h2>Welcome!</h2>
          <p>You are now logged in.</p>
          <Link to="/paymentgateway">
            <Button primary>Go to Payment Gateway</Button>
          </Link>
        </div>
      )}
    </Container>
  );
};

export default ZeroKnowledgeAuth;
