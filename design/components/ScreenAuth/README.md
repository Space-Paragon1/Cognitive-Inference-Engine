Sign in, create account, forgot password and set new password, at desktop 1440 and mobile 390.

**Maps to** `LoginPage`. Built from `TextField` and `Button`.

## Layout
- Desktop: a split screen. The left brand panel has the logo, "A calm coach for how you study.", a short description, three promises (Never reads what you type · High load is information · Laptop and phone) and a quiet gauge illustration. The right side has a 400px form column, vertically centred.
- Mobile: a single column with the logo on top and the form under it. Primary buttons are `lg` (52px) and full width.

## States shown
- Sign in after a failed attempt: "That email and password do not match. Check both and try again." The button is in its loading state ("Signing in…").
- Create your account ("Takes a minute. Your data stays yours.") with inline validation: "Add the rest of your email, like sam@uni.edu." and "Use at least 8 characters.", plus a strength meter and the terms checkbox.
- Forgot password: "Reset your password", then a deliberately neutral confirmation: "Check your inbox. If that email is registered, a link has been sent. It works for 30 minutes." Resend is disabled for a short countdown ("Resend in 0:42"). Never confirm whether an account exists.
- Set a new password, arriving from the email link: strength ("Strong. 12+ characters."), confirm ("Passwords match."), and a note for expired links ("If the link has expired, request a new one. Reset links last 30 minutes.").

## Notes
Errors sit under their field and are announced. Submit stays enabled; validate on submit and blur. After sign-in, first-time users go to onboarding and returning users go to Now.
