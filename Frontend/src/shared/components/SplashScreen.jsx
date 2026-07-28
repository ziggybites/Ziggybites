import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, CupSoda, IceCreamBowl, Pizza, ShoppingBag } from 'lucide-react';
import { getCachedSettings, loadBusinessSettings, normalizeKitchenAppName } from '@/modules/Food/utils/businessSettings';

const riderSplashImage = '/Loading Logo.png';

export default function SplashScreen({ onFinish }) {
  const [isFinishing, setIsFinishing] = useState(false);
  const [brand, setBrand] = useState(() => {
    const cached = getCachedSettings();
    return {
      logoUrl: cached?.logo?.url || '',
      companyName: normalizeKitchenAppName(cached?.companyName) || 'ZiggyBites',
    };
  });

  useEffect(() => {
    let mounted = true;
    loadBusinessSettings()
      .then((settings) => {
        if (!mounted || !settings) return;
        setBrand({
          logoUrl: settings.logo?.url || '',
          companyName: normalizeKitchenAppName(settings.companyName) || 'ZiggyBites',
        });
      })
      .catch(() => { });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let finishTimer;
    const timer = setTimeout(() => {
      setIsFinishing(true);
      finishTimer = setTimeout(() => {
        if (onFinish) onFinish();
      }, 550);
    }, 4200);

    return () => {
      clearTimeout(timer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  const doodles = [
    { Icon: Pizza, x: '14%', y: '14%', rotate: -18 },
    { Icon: Cookie, x: '78%', y: '13%', rotate: 15 },
    { Icon: CupSoda, x: '12%', y: '42%', rotate: -8 },
    { Icon: IceCreamBowl, x: '82%', y: '38%', rotate: 12 },
    { Icon: ShoppingBag, x: '80%', y: '73%', rotate: -10 },
    { Icon: Cookie, x: '16%', y: '78%', rotate: 20 },
  ];

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center overflow-hidden bg-white">
      <AnimatePresence mode="wait">
        {!isFinishing && (
          <motion.div
            key="splash-content"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.08 }}
            transition={{
              exit: { duration: 0.45, ease: [0.45, 0, 0.55, 1] },
              duration: 0.35,
              ease: 'easeOut',
            }}
            className="relative h-full w-full max-w-md overflow-hidden bg-white"
          >
            {doodles.map(({ Icon, x, y, rotate }, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.16, 0.28, 0.16], y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, delay: index * 0.2 }}
                className="absolute text-red-100"
                style={{ left: x, top: y, rotate }}
              >
                <Icon className="h-8 w-8" strokeWidth={1.2} />
              </motion.div>
            ))}

            <div className="absolute left-1/2 top-[35%] flex w-full -translate-x-1/2 -translate-y-1/2 flex-col items-center px-8">
              <motion.div
                initial={{ x: '-70vw', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 2.25, ease: [0.22, 1, 0.36, 1] }}
                className="relative flex h-48 w-48 items-center justify-center"
              >
                <div className="absolute left-2 top-1/2 h-0.5 w-14 -translate-y-8 rounded-full bg-gray-800/35" />
                <div className="absolute left-0 top-1/2 h-0.5 w-20 -translate-y-3 rounded-full bg-gray-800/30" />
                <div className="absolute left-6 top-1/2 h-0.5 w-12 translate-y-2 rounded-full bg-gray-800/25" />
                <img
                  src={riderSplashImage}
                  alt={`${brand.companyName} loading logo`}
                  className="relative z-10 h-44 w-44 object-contain"
                />
              </motion.div>

              <motion.h1
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.25, duration: 0.55, ease: 'easeOut' }}
                className="mt-1 text-4xl font-black italic tracking-tight text-[#f21d1d]"
              >
                {brand.companyName || 'ZiggyBites'}
              </motion.h1>
            </div>

            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.75, duration: 0.4 }}
              className="absolute bottom-28 left-0 right-0 text-center text-xs font-black text-[#202030]"
            >
              Delivering Happiness, <span className="italic text-[#f21d1d]">Fast!</span>
            </motion.p>

            <div className="absolute bottom-0 left-0 right-0 h-32 bg-[#fff1e2]" style={{ clipPath: 'polygon(0 48%, 18% 68%, 42% 82%, 66% 70%, 86% 46%, 100% 34%, 100% 100%, 0 100%)' }} />
            <div className="absolute bottom-0 left-0 right-0 h-28 bg-[#ff981f]" style={{ clipPath: 'polygon(0 58%, 18% 76%, 42% 86%, 66% 74%, 84% 48%, 100% 36%, 100% 100%, 0 100%)' }} />
            <div className="absolute bottom-0 left-0 right-0 h-28 bg-[#f21d1d]" style={{ clipPath: 'polygon(0 28%, 18% 50%, 40% 68%, 64% 76%, 84% 62%, 100% 50%, 100% 100%, 0 100%)' }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

