import React from "react";
import { BadgePercent } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function OffersBanner() {
  const navigate = useNavigate();
  return (
    <section className="mt-4 rounded-[10px] bg-[#fff3ee] border border-[#ffe1d2] min-h-[78px] overflow-hidden flex items-center">
              <div className="w-16 flex justify-center">
                <span className="h-10 w-10 rounded-full bg-[#e92823] text-white flex items-center justify-center">
                  <BadgePercent className="h-6 w-6" />
                </span>
              </div>
              <div className="flex-1 min-w-0 py-3">
                <p className="text-[8px] font-black uppercase tracking-[0.12em] text-[#d9251d]">
                  Exclusive Offers
                </p>
                <h2 className="text-[14px] font-black leading-tight text-[#b7221d]">
                  Save More on
                  <br />
                  Your Meal Plans!
                </h2>
                <p className="mt-1 text-[8px] font-semibold text-[#7b594d]">
                  Grab exciting discounts on weekly & monthly plans.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/food/user/offers")}
                className="mr-3 h-7 px-3 rounded-md bg-[#d9251d] text-white text-[8px] font-black"
              >
                View Offers
              </button>
            </section>
  );
}
