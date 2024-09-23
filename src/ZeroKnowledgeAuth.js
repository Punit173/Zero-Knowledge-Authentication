import React, { useState } from "react";
import { auth, db } from "./components/firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { setDoc, doc } from "firebase/firestore";
import { openDB } from "idb";
// import styled from "styled-components";
import { Link } from "react-router-dom";
import "./ZeroKnowledgeAuth.css";
import "./OIP-removebg.png";

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


const ZeroKnowledgeAuth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [isLogin, setIsLogin] = useState(true); // Toggle between login and signup
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Function to generate public and private keys
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

    // Export and save the public key
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

    // Store the public key in state
    setPublicKey(publicKeyPemString);

    // Export the private key
    const privateKeyPem = await window.crypto.subtle.exportKey(
      "pkcs8",
      keyPair.privateKey
    );

    // Encrypt the private key with the user's password
    const { encryptedData, salt, iv } = await encryptData(
      privateKeyPem,
      encryptionPassword
    );

    // Store the encrypted private key, salt, and iv in IndexedDB
    const db = await dbPromise;
    await db.put("keys", { encryptedData, salt, iv }, email);
  };

  // Handle signup
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
      const setDocWithTimeout = (docRef, data, timeout) => {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("setDoc operation timed out")),
            timeout
          )
        );
        return Promise.race([setDoc(docRef, data), timeoutPromise]);
      };

      try {
        await setDocWithTimeout(
          doc(db, "users", userCredential.user.uid),
          {
            email: email,
            publicKey: publicKey,
          },
          5000
        );
        console.log("Document successfully written");
      } catch (error) {
        if (error.message === "setDoc operation timed out") {
          console.error("The setDoc operation took too long and was aborted.");
        } else {
          console.error("Error writing document:", error);
        }
      }

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
    <div className="container">
      {!isLoggedIn ? (
        <div className="form-wrapper">
          <h2 className="title">{isLogin ? "Login" : "SignUp"} Page</h2>
          <form onSubmit={isLogin ? handleLogin : handleSignup}>
            <input
              className="input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              className="input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {!isLogin && (
              <>
                <button
                  type="button"
                  className="button_gen"
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
                </button>
                <textarea
                  className="text-area"
                  rows="6"
                  value={publicKey}
                  readOnly
                  placeholder="Your Public Key will appear here..."
                />
              </>
            )}

            <button
              className="button_gen"
              type="submit"
              disabled={loading}
              // style={{ width: loading ? '50%' : '100%' }}
            >
              {loading ? "Processing..." : isLogin ? "Login" : "SignUp"}
            </button>

            {error && <p className="error-message">{error}</p>}

            <p className="toggle-link">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <button type="button" onClick={() => setIsLogin(!isLogin)}>
                {isLogin ? "SignUp" : "Login"}
              </button>
            </p>
          </form>
        </div>
      ) : (
        <div>
          <h2>Welcome!</h2>
          <p>You are now logged in.</p>
          <Link to="/paymentgateway">
            <button className="button_gen">Go to Payment Gateway</button>
          </Link>
        </div>
      )}
    </div>
  );
};

export default ZeroKnowledgeAuth;
