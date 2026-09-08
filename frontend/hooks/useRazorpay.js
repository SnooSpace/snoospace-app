import React, { useState } from 'react';
import RazorpayCheckout from '../components/razorpay/RazorpayCheckout';

export const useRazorpay = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [checkoutOptions, setCheckoutOptions] = useState(null);
  const [callbacks, setCallbacks] = useState(null);

  const cleanup = () => {
    setIsVisible(false);
    setTimeout(() => {
      setCallbacks(null);
      setCheckoutOptions(null);
    }, 100);
  };

  const openCheckout = (options, cbs) => {
    if (isVisible) return;
    setCheckoutOptions(options);
    setCallbacks(cbs);
    setIsVisible(true);
  };

  const closeCheckout = () => {
    setIsVisible(false);
    if (callbacks?.onClose) {
      callbacks.onClose();
    }
    setTimeout(() => {
      setCallbacks(null);
      setCheckoutOptions(null);
    }, 100);
  };

  const RazorpayUI =
    isVisible && checkoutOptions && callbacks ? (
      <RazorpayCheckout
        options={checkoutOptions}
        onSuccess={(data) => {
          if (callbacks?.onSuccess) {
            callbacks.onSuccess(data);
          }
          cleanup();
        }}
        onFailure={(error) => {
          const formattedError = error?.error || error || {
            description: 'Payment could not be completed. Please try again.',
          };
          if (callbacks?.onFailure) {
            callbacks.onFailure(formattedError);
          }
          cleanup();
        }}
        onClose={closeCheckout}
      />
    ) : null;

  return {
    openCheckout,
    closeCheckout,
    RazorpayUI,
    isVisible,
  };
};

export default useRazorpay;
