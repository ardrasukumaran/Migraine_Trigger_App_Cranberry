import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Berry } from '@/components/Berry';
import { ArrowLeft } from 'lucide-react';

export const Route = createFileRoute('/login')({
  head: () => ({
    meta: [{ title: 'Sign in — Migraine tracker' }],
  }),
  component: LoginPage,
});

const COUNTRY_CODES = [
  { code: '+1',   label: '+1' },
  { code: '+1',   label: '+1' },
  { code: '+44',  label: '+44' },
  { code: '+91',  label: '+91' },
  { code: '+61',  label: '+61' },
  { code: '+64',  label: '+64' },
  { code: '+49',  label: '+49' },
  { code: '+33',  label: '+33' },
  { code: '+39',  label: '+39' },
  { code: '+34',  label: '+34' },
  { code: '+31',  label: '+31' },
  { code: '+46',  label: '+46' },
  { code: '+47',  label: '+47' },
  { code: '+45',  label: '+45' },
  { code: '+358', label: '+358' },
  { code: '+41',  label: '+41' },
  { code: '+43',  label: '+43' },
  { code: '+32',  label: '+32' },
  { code: '+351', label: '+351' },
  { code: '+30',  label: '+30' },
  { code: '+48',  label: '+48' },
  { code: '+7',   label: '+7' },
  { code: '+380', label: '+380' },
  { code: '+55',  label: '+55' },
  { code: '+52',  label: '+52' },
  { code: '+54',  label: '+54' },
  { code: '+56',  label: '+56' },
  { code: '+57',  label: '+57' },
  { code: '+51',  label: '+51' },
  { code: '+58',  label: '+58' },
  { code: '+81',  label: '+81' },
  { code: '+82',  label: '+82' },
  { code: '+86',  label: '+86' },
  { code: '+65',  label: '+65' },
  { code: '+60',  label: '+60' },
  { code: '+63',  label: '+63' },
  { code: '+66',  label: '+66' },
  { code: '+84',  label: '+84' },
  { code: '+62',  label: '+62' },
  { code: '+880', label: '+880' },
  { code: '+92',  label: '+92' },
  { code: '+94',  label: '+94' },
  { code: '+971', label: '+971' },
  { code: '+966', label: '+966' },
  { code: '+972', label: '+972' },
  { code: '+90',  label: '+90' },
  { code: '+20',  label: '+20' },
  { code: '+234', label: '+234' },
  { code: '+27',  label: '+27' },
  { code: '+254', label: '+254' },
  { code: '+233', label: '+233' },
  { code: '+212', label: '+212' },
];

function generateOtp(): string {
  return '1234';
}

async function sendOtp(phone: string, otp: string): Promise<void> {
  try {
    const res = await fetch(`/api/send-otp?phone=${encodeURIComponent(phone)}&otp=${encodeURIComponent(otp)}`);
    const data = await res.json();
    console.log("[sendOtp response]", data);
  } catch (err) {
    console.error("[sendOtp error]", err);
  }
}

function LoginPage() {
  const { login, phone, isLoading } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pendingPhone, setPendingPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [error, setError] = useState('');
  const [resendSeconds, setResendSeconds] = useState(0);
  const [resendNotice, setResendNotice] = useState('');

  useEffect(() => {
    if (!isLoading && phone) navigate({ to: '/' });
  }, [isLoading, phone, navigate]);

  // 20-second resend cooldown timer
  useEffect(() => {
    if (resendSeconds <= 0) return;
    const id = setInterval(() => setResendSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [resendSeconds]);

  function handleResend() {
    const newOtp = generateOtp();
    setGeneratedOtp(newOtp);
    sendOtp(pendingPhone, newOtp);
    setOtp('');
    setError('');
    setResendSeconds(20);
    setResendNotice('A new OTP has been sent.');
    setTimeout(() => setResendNotice(''), 3000);
  }

  function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length < 6) {
      setError('Please enter a valid phone number.');
      return;
    }
    const full = `${countryCode}${digits}`;
    const newOtp = generateOtp();
    setGeneratedOtp(newOtp);
    sendOtp(full, newOtp);
    setPendingPhone(full);
    setError('');
    setResendSeconds(20);
    setStep('otp');
  }

  function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = otp.trim();
    if (code.length !== 4 || !/^\d{4}$/.test(code)) {
      setError('Please enter the 4-digit OTP.');
      return;
    }
    if (code !== generatedOtp) {
      setError('Invalid OTP. Please try again.');
      return;
    }
    login(pendingPhone);
    navigate({ to: '/' });
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError('');
    setPhoneNumber(e.target.value.replace(/[^\d\s\-()]/g, ''));
  }

  return (
    <div className="phone-frame bg-background flex flex-col">
      {/* Purple glow at top */}
      <div
        className="absolute inset-x-0 top-0 h-56 pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(123,107,168,0.28) 0%, transparent 70%)',
        }}
        aria-hidden
      />

      <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-5 py-10">

        {/* Berry + wordmark */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <Berry mood="wave" size={80} />
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.22em] text-warm-grey/50 font-medium mb-1">
              Migraine tracker
            </p>
            <h1 className="font-serif-display text-[28px] leading-tight text-foreground">
              {step === 'phone' ? 'Welcome.' : 'OTP Verification.'}
            </h1>
            <p className="mt-1 text-sm text-warm-grey/70">
              {step === 'phone'
                ? 'Sign in with your phone number to continue.'
                : `Enter the 4-digit OTP sent to ${pendingPhone}`}
            </p>
          </div>
        </div>

        {/* ── Step 1: Phone number ── */}
        {step === 'phone' && (
          <form onSubmit={handlePhoneSubmit} className="w-full space-y-4" noValidate>
            <div>
              <label className="block text-xs uppercase tracking-[0.16em] text-warm-grey/60 font-semibold mb-2">
                Phone number
              </label>
              <div className="flex gap-2">
                <div className="relative shrink-0">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="appearance-none h-12 px-2 rounded-xl bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#7B6BA8] focus:border-[#7B6BA8] transition cursor-pointer w-[72px]"
                  >
                    {COUNTRY_CODES.map((c, i) => (
                      <option key={`${c.code}-${i}`} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="e.g. 98765 43210"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  className="flex-1 h-12 px-4 rounded-xl bg-card border border-border text-foreground text-sm placeholder:text-warm-grey/40 focus:outline-none focus:ring-2 focus:ring-[#7B6BA8] focus:border-[#7B6BA8] transition"
                  autoComplete="tel-local"
                  required
                />
              </div>
              {error && (
                <p className="mt-2 text-xs text-destructive" role="alert">{error}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full h-12 rounded-xl font-semibold text-sm text-white transition active:scale-[0.98]"
              style={{ backgroundColor: '#7B6BA8' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#6a5b97')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#7B6BA8')}
            >
              Continue
            </button>
          </form>
        )}

        {/* ── Step 2: OTP ── */}
        {step === 'otp' && (
          <form onSubmit={handleOtpSubmit} className="w-full space-y-4" noValidate>
            <div>
              <label className="block text-xs uppercase tracking-[0.16em] text-warm-grey/60 font-semibold mb-2">
                One-time password
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder="----"
                value={otp}
                onChange={(e) => {
                  setError('');
                  setOtp(e.target.value.replace(/\D/g, '').slice(0, 4));
                }}
                className="w-full h-12 px-4 rounded-xl bg-card border border-border text-foreground placeholder:text-warm-grey/30 focus:outline-none focus:ring-2 focus:ring-[#7B6BA8] focus:border-[#7B6BA8] transition tracking-[0.5em] text-center text-xl font-semibold"
                autoComplete="one-time-code"
                autoFocus
                required
              />
              {error && (
                <p className="mt-2 text-xs text-destructive text-center" role="alert">{error}</p>
              )}
              {resendNotice && !error && (
                <p className="mt-2 text-xs text-warm-grey/70 text-center" role="status">{resendNotice}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full h-12 rounded-xl font-semibold text-sm text-white transition active:scale-[0.98]"
              style={{ backgroundColor: '#7B6BA8' }}
            >
              Verify & Sign in
            </button>

            <div className="flex items-center justify-center text-xs text-warm-grey/70">
              <span>Didn't get the code?&nbsp;</span>
              {resendSeconds > 0 ? (
                <span className="font-semibold text-warm-grey/40 tabular-nums">
                  Resend in {resendSeconds}s
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  className="font-semibold text-[#7B6BA8] hover:underline"
                >
                  Resend OTP
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setStep('phone');
                setOtp('');
                setError('');
                setResendNotice('');
                setResendSeconds(0);
              }}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-warm-grey/60 font-medium py-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to phone number
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
