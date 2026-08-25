import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  CheckCircle2,
  X,
  Package,
} from 'lucide-react';
import { deliveryAPI } from '@food/api';
import { useDeliveryStore } from '@/modules/DeliveryV2/store/useDeliveryStore';
import { ActionSlider } from '@/modules/DeliveryV2/components/ui/ActionSlider';

const Backdrop = ({ onClose }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="absolute inset-0 bg-black/40 -z-10 pointer-events-auto"
    onClick={onClose}
  />
);

const DeliveryInstructionsPanel = ({ note }) => {
  const text = String(note || '').trim();
  if (!text) return null;

  return (
    <div className="w-full rounded-3xl mb-6 overflow-hidden border border-orange-100 shadow-sm">
      <div className="bg-linear-to-r from-orange-500 to-amber-500 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-white/20 rounded-2xl flex items-center justify-center text-white">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-black text-white uppercase tracking-[0.2em]">
              Delivery instruction
            </p>
            <p className="text-[11px] font-semibold text-white/90">
              Read before handover
            </p>
          </div>
        </div>
      </div>
      <div className="bg-orange-50 px-5 py-4">
        <p className="text-sm font-bold text-gray-950 leading-relaxed wrap-break-word">
          "{text}"
        </p>
      </div>
    </div>
  );
};

const OtpModal = ({ order, onVerified, onClose }) => {
  const [otp, setOtp] = useState(['', '', '', '']);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const inputRefs = [useRef(), useRef(), useRef(), useRef()];

  useEffect(() => {
    const savedCode = order?.deliveryVerification?.dropOtp?.code;
    if (savedCode && String(savedCode).length === 4) {
      setOtp(String(savedCode).split(''));
    }
    const timer = setTimeout(() => {
      inputRefs[0].current?.focus();
    }, 500);
    return () => clearTimeout(timer);
  }, [order?.deliveryVerification?.dropOtp?.code]);

  const orderId = order.orderId || order._id || 'ORD';

  const handleOtpChange = (index, value) => {
    if (value && !/^\d+$/.test(value)) return;
    const nextOtp = [...otp];
    nextOtp[index] = value.substring(value.length - 1);
    setOtp(nextOtp);
    if (value && index < 3) inputRefs[index + 1].current?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const verifyOtp = async () => {
    const otpString = otp.join('');
    if (otpString.length < 4) return;
    setIsVerifyingOtp(true);
    try {
      const res = await deliveryAPI.verifyDropOtp(orderId, otpString);
      if (res?.data?.success) {
        try {
          const { setActiveOrder, activeOrder: currentOrder } = useDeliveryStore.getState();
          if (currentOrder) {
            setActiveOrder({
              ...currentOrder,
              deliveryVerification: {
                ...currentOrder.deliveryVerification,
                dropOtp: {
                  ...currentOrder.deliveryVerification?.dropOtp,
                  verified: true,
                  code: otpString,
                },
              },
            });
          }
        } catch (e) {
          console.warn('Failed to update global store state:', e);
        }

        setIsOtpVerified(true);
        setTimeout(() => onVerified(otpString), 600);
      }
    } catch (err) {
      throw err;
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const isAlreadyVerified = order?.deliveryVerification?.dropOtp?.verified;

  return (
    <div className="fixed inset-0 z-120 p-0 sm:p-4 flex items-end justify-center pointer-events-none">
      <Backdrop onClose={onClose} />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="w-full max-w-md sm:max-w-lg bg-white rounded-t-3xl sm:rounded-t-[2.5rem] shadow-[0_-20px_60px_rgba(0,0,0,0.3)] p-4 sm:p-6 pb-6 sm:pb-12 pointer-events-auto max-h-[84vh] overflow-y-auto"
      >
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isOtpVerified ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Handover Code</h2>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Delivery verification</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <DeliveryInstructionsPanel note={order?.note} />

        <div className="flex justify-center gap-2.5 sm:gap-3 mb-6 sm:mb-8">
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={inputRefs[i]}
              type="number"
              disabled={isOtpVerified}
              value={digit}
              onChange={(e) => handleOtpChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className={`w-12 sm:w-14 h-16 sm:h-18 bg-gray-50 border-2 rounded-2xl text-center text-2xl sm:text-3xl font-bold transition-all ${
                isOtpVerified ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 focus:border-green-600 text-gray-700'
              }`}
            />
          ))}
        </div>

        <ActionSlider
          key="action-otp"
          label={isVerifyingOtp ? 'Verifying...' : isAlreadyVerified ? 'Code already verified' : 'Slide to Verify OTP'}
          successLabel="Verified!"
          disabled={otp.some((d) => !d) || isVerifyingOtp || isOtpVerified || isAlreadyVerified}
          onConfirm={verifyOtp}
          color="bg-gray-900"
        />
      </motion.div>
    </div>
  );
};

export const DeliveryVerificationModal = ({ order, onComplete, onClose }) => {
  const alreadyVerified = !!order?.deliveryVerification?.dropOtp?.verified;
  const [step, setStep] = useState(() => (alreadyVerified ? 'complete' : 'otp'));
  const [verifiedOtp, setVerifiedOtp] = useState(
    alreadyVerified ? (order?.deliveryVerification?.dropOtp?.code || '') : '',
  );

  const handleOtpVerified = (otpValue) => {
    setVerifiedOtp(otpValue);
    setStep('complete');
  };

  useEffect(() => {
    if (step === 'complete' && alreadyVerified) {
      onComplete(verifiedOtp);
    }
  }, []); // intentional mount-only auto-complete for already-verified state

  if (!order) return null;

  return (
    <AnimatePresence mode="wait">
      {step === 'otp' && (
        <OtpModal
          key="otp-modal"
          order={order}
          onVerified={handleOtpVerified}
          onClose={onClose || (() => {})}
        />
      )}
      {step === 'complete' && (
        <div className="fixed inset-0 z-120 p-0 sm:p-4 flex items-end justify-center pointer-events-none">
          <Backdrop onClose={onClose || (() => {})} />
          <motion.div
            key="complete-modal"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="w-full max-w-md sm:max-w-lg bg-white rounded-t-3xl sm:rounded-t-[2.5rem] shadow-[0_-20px_60px_rgba(0,0,0,0.3)] p-4 sm:p-6 pb-6 sm:pb-12 pointer-events-auto max-h-[84vh] overflow-y-auto"
          >
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-green-100 text-green-600">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">OTP Verified</h2>
                <p className="text-[10px] font-bold uppercase tracking-widest text-green-600">Ready To Complete Delivery</p>
              </div>
            </div>
            <ActionSlider
              key="action-complete"
              label="Slide to Complete Delivery"
              successLabel="Delivered!"
              onConfirm={async () => {
                await onComplete(verifiedOtp);
              }}
              color="bg-green-600"
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default DeliveryVerificationModal;
