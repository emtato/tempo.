import {authClient} from "../api/auth-client";
import React from "react";

interface AuthOverlayProps {
    onClose: () => void;
    onRevealComplete: () => void;
    origin: {
        x: number;
        y: number;
    };
    onAuthSuccess: () => void;
    loginChosen: boolean;
}

export default function AuthOverlay({onClose, onRevealComplete, origin, loginChosen}: AuthOverlayProps) {

    const [isNewAccount, setIsNewAccount] = React.useState(!loginChosen);
    const [signInError, setSignInError] = React.useState("");

    function toggleNewAccount() {
        setIsNewAccount(!isNewAccount);
        setSignInError("")
    }


    function setErrorMessage(result: Awaited<ReturnType<typeof authClient.signIn.username>>) {
        if (result.error.message) {
            setSignInError(result.error.message);
            if (result.error.message.includes("[body.password]") || result.error.message.includes("Password too short")) {
                setSignInError("Password is too short")
            }
        } else {
            setSignInError("unknown error :< " + result.error)
        }
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        try {
            const data = new FormData(event.currentTarget);
            const username = String(data.get("username")).trimEnd();
            const password = String(data.get("password"));
            const email = username + "@gmail.com" // temp email for auth to be happy. verification/passsword reset later TODO

            if (!isNewAccount) {
                const result = await authClient.signIn.username({username, password});
                console.log(result)
                if (!result.error) {
                    //success
                    onClose()
                } else {
                    setErrorMessage(result);
                }
            } else {
                const name = String(data.get("name"));
                const result = await authClient.signUp.email({name, email, username, password});
                console.log(result)

                if (!result.error) {
                    //success
                    onClose()
                } else {
                    setErrorMessage(result);
                }
            }
        } catch (error) {
            console.error("Authentication request failed:", error)
            setSignInError("Our server is giving you the silent treatment right now. Try again later?")
        }
    }

    return (
        <div
            className="auth-panel"
            style={{
                "--auth-origin-x": `${origin.x}px`,
                "--auth-origin-y": `${origin.y}px`,
            } as React.CSSProperties}
            onAnimationEnd={(event) => {
                if (event.target === event.currentTarget) onRevealComplete()
            }}
        >
            <button
                className="auth-close-button"
                type="button"
                aria-label="Close login"
                onClick={onClose}
                style={{fontSize: "1.5rem", lineHeight: 1}}>
                ×
            </button>
            <div className="auth-content">
                <p className="auth-eyebrow">Keep pace with your day.</p>
                <h2 className="auth-title">Welcome to Tempo:</h2>
                <form onSubmit={handleSubmit}>

                    {isNewAccount && <input name="name" placeholder="What should we call you?" className="auth-input"/>}
                    <input name="username" /*type="email"*/ placeholder="username" className="auth-input"/><input
                    name="password" type="password" placeholder="password (i won't tell anyone!)" className="auth-input"/><br/>
                    {isNewAccount && <button className="auth-submit-button" type="submit">Create Account</button>}
                    {!isNewAccount && <button className="auth-submit-button" type="submit">Sign In</button>}
                </form>
                <div className="auth-bottom-row">
                    <span>... or  </span>
                    {isNewAccount && <button onClick={toggleNewAccount} className="auth-text-button" type="button">sign in</button>}
                    {!isNewAccount && <button onClick={toggleNewAccount} className="auth-text-button" type="button">create account</button>}
                    {signInError && (<p className="auth-error-message">{signInError}</p>)}
                    <button onClick={onClose} className="auth-text-button" type="button">
                    </button>
                </div>
            </div>
        </div>
    )
}
