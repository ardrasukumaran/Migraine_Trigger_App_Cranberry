import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Berry } from '@/components/Berry';
import { ArrowLeft } from 'lucide-react';
import { NotificationPrompt } from '@/components/NotificationPrompt';

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

function LoginPage() {
  const { login, phone, isLoading } = useAuth();
  const navigate = useNavigate();

  const [step, setStep]               = useState<'phone' | 'order'>('phone');
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pendingPhone, setPendingPhone] = useState('');
  const [orderId, setOrderId]         = useState('');
  const [error, setError]             = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [loggedInPhone, setLoggedInPhone] = useState(''); // ← NEW

  useEffect(() => {
    if (!isLoading && phone) navigate({ to: '/' });
  }, [isLoading, phone, navigate]);

  function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length < 6) {
      setError('Please enter a valid phone number.');
      return;
    }
    setPendingPhone(`${countryCode}${digits}`);
    setError('');
    setStep('order');
  }

  async function handleOrderIdSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orderId.trim()) {
      setError('Please enter your Order ID.');
      return;
    }
    setIsVerifying(true);
    setError('');
    try {
      const res  = await fetch('/api/verify-user', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: pendingPhone, order_id: orderId.trim() }),
      });
      const data = await res.json() as { verified: boolean; message: string; token?: string; phone?: string };
      if (data.verified && data.token && data.phone) {
        login(data.phone, data.token);
        setLoggedInPhone(data.phone); // ← NEW: show notification prompt
        // navigate happens after notification prompt is shown
        setTimeout(() => navigate({ to: '/' }), 3000); // ← give time for prompt
      } else {
        setError(data.message ?? 'Invalid phone or order ID.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError('');
    setPhoneNumber(e.target.value.replace(/[^\d\s\-()]/g, ''));
  }

  return (
    <div className="phone-frame bg-background flex flex-col">

      {/* ── Notification prompt — shows after login success ── */}
      {loggedInPhone && <NotificationPrompt mobile={loggedInPhone} />}

      <div
        className="absolute inset-x-0 top-0 h-56 pointer-events-none z-0"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(123,107,168,0.28) 0%, transparent 70%)',
        }}
        aria-hidden
      />

      <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-5 py-10">
        <div className="flex flex-col items-center gap-3 mb-8">
          <Berry mood="wave" size={80} />
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.22em] text-warm-grey/50 font-medium mb-1">
              Migraine tracker
            </p>
            <h1 className="font-serif-display text-[28px] leading-tight text-foreground">
              {step === 'phone' ? 'Welcome.' : 'Verify your identity.'}
            </h1>
            <p className="mt-1 text-sm text-warm-grey/70">
              {step === 'phone'
                ? 'Sign in with your phone number to continue.'
                : 'Enter the Order ID from your purchase confirmation.'}
            </p>
          </div>
        </div>

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
                      <option key={`${c.code}-${i}`} value={c.code}>{c.label}</option>
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
              {error && <p className="mt-2 text-xs text-destructive" role="alert">{error}</p>}
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

        {step === 'order' && (
          <form onSubmit={handleOrderIdSubmit} className="w-full space-y-4" noValidate>
            <div>
              <label className="block text-xs uppercase tracking-[0.16em] text-warm-grey/60 font-semibold mb-2">
                Order ID
              </label>
              <input
                type="text"
                placeholder="Enter your Order ID"
                value={orderId}
                onChange={(e) => { setError(''); setOrderId(e.target.value); }}
                className="w-full h-12 px-4 rounded-xl bg-card border border-border text-foreground text-sm placeholder:text-warm-grey/40 focus:outline-none focus:ring-2 focus:ring-[#7B6BA8] focus:border-[#7B6BA8] transition tracking-widest text-center text-lg font-semibold"
                autoFocus
                required
              />
              {error && <p className="mt-2 text-xs text-destructive text-center" role="alert">{error}</p>}
            </div>
            <button
              type="submit"
              disabled={isVerifying}
              className="w-full h-12 rounded-xl font-semibold text-sm text-white transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#7B6BA8' }}
            >
              {isVerifying ? 'Verifying…' : 'Verify & Sign in'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('phone'); setOrderId(''); setError(''); }}
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
