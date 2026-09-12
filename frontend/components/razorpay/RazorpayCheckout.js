import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Keyboard,
  Linking,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';

const RAZORPAY_SUCCESS_GREEN = '#009e5c';

export const RazorpayCheckout = ({
  options,
  onSuccess,
  onFailure,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const webViewRef = useRef(null);
  const [isBackdropDimmed, setIsBackdropDimmed] = useState(true);
  const [isPaymentSuccess, setIsPaymentSuccess] = useState(false);
  const [hasRendered, setHasRendered] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const isExitModalOpenRef = useRef(false);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const isLightColor = (hexColor) => {
    if (!hexColor) return true;
    const c = hexColor.trim().toLowerCase();
    if (c === '#ffffff' || c === '#fff' || c === 'white') return true;
    const hex = c.replace('#', '');
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.6;
    }
    return false;
  };

  const themeColor = options?.theme?.color || '#FFFFFF';
  const isLight = isLightColor(themeColor);
  const effectiveStatusBarStyle = isPaymentSuccess
    ? 'light-content'
    : isBackdropDimmed
    ? 'light-content'
    : (isLight ? 'dark-content' : 'light-content');

  // Smooth animated backdrop value for status bar dimming (matching SwipeableModal / CommentsModal)
  const backdropAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(backdropAnim, {
      toValue: isPaymentSuccess ? 0 : (isBackdropDimmed ? 1 : 0),
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [isBackdropDimmed, isPaymentSuccess]);

  // Top inset to ensure Razorpay content sits safely below the physical status bar
  const topInset = Platform.OS === 'android'
    ? Math.max(insets.top || 0, StatusBar.currentHeight || 24)
    : (insets.top || 0);

  useEffect(() => {
    StatusBar.setBarStyle(effectiveStatusBarStyle, true);
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor('transparent', true);
      StatusBar.setTranslucent(true);
      try {
        NavigationBar.setBackgroundColorAsync(isPaymentSuccess ? RAZORPAY_SUCCESS_GREEN : 'transparent');
        NavigationBar.setButtonStyleAsync(isPaymentSuccess ? 'light' : (isBackdropDimmed ? 'light' : 'dark'));
      } catch (_) {}
    }
    return () => {
      StatusBar.setBarStyle('dark-content', true);
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor('transparent', true);
        try {
          NavigationBar.setBackgroundColorAsync('transparent');
          NavigationBar.setButtonStyleAsync('dark');
        } catch (_) {}
      }
    };
  }, [effectiveStatusBarStyle, isBackdropDimmed, isPaymentSuccess]);

  // Unified back handler: handles back swipe / hardware back press
  // 1. If exit confirmation modal is already showing -> dismisses exit modal and stays in payment
  // 2. If at the main screen -> triggers Razorpay's native exit confirmation modal and dims status bar
  const handleRequestClose = () => {
    if (!hasRendered) {
      setIsBackdropDimmed(false);
      isExitModalOpenRef.current = false;
      onClose();
      return;
    }

    // If exit modal is already open, back gesture cancels exit modal and stays in payment
    if (isExitModalOpenRef.current) {
      setIsBackdropDimmed(false);
      isExitModalOpenRef.current = false;
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          (function() {
            if (window.handleAppBack) {
              window.handleAppBack();
            }
          })();
          true;
        `);
      }
      return;
    }

    // Back gesture from checkout root opens the exit confirmation modal!
    setIsBackdropDimmed(true);
    isExitModalOpenRef.current = true;

    if (webViewRef.current) {
      webViewRef.current.goBack();
      webViewRef.current.injectJavaScript(`
        (function() {
          if (window.handleAppBack) {
            window.handleAppBack();
          }
        })();
        true;
      `);
    }
  };

  // Proactive touch handler on the WebView wrapper to seamlessly detect exit modal, bottom sheets, and dismissal gestures
  const handleTouchStart = (e) => {
    try {
      if (!hasRendered) return;

      const { locationX, locationY } = e.nativeEvent;
      const webviewHeight = screenHeight - topInset;

      if (!isBackdropDimmed) {
        // 1. In-checkout header back arrow (top-left of header: x < 75, y < 65) -> opens Exit Confirmation Modal!
        if (locationX < 75 && locationY < 65) {
          setIsBackdropDimmed(true);
          isExitModalOpenRef.current = true;
          return;
        }

        // 2. Profile icon in header (top-right of Razorpay header: x > width - 75, y < 65) -> opens Account & Terms
        if (locationX > screenWidth - 75 && locationY < 65) {
          setIsBackdropDimmed(true);
          isExitModalOpenRef.current = false;
          return;
        }

        // 3. Bottom amount / price summary bar (sticky at the bottom of checkout) -> opens Price summary
        if (locationY > webviewHeight - 85) {
          setIsBackdropDimmed(true);
          isExitModalOpenRef.current = false;
          return;
        }
      } else {
        // When backdrop is dimmed (Exit Confirmation Modal OR Bottom Sheet is showing):

        // 1. Dimmed backdrop touch:
        // For Exit Modal, upper backdrop is y < 0.58 * webviewHeight.
        // For Bottom Sheets, upper backdrop is y < 0.68 * webviewHeight.
        const backdropThreshold = isExitModalOpenRef.current
          ? webviewHeight * 0.58
          : webviewHeight * 0.68;

        if (locationY < backdropThreshold) {
          setIsBackdropDimmed(false);
          isExitModalOpenRef.current = false;
          return;
        }

        // 2. Tapping the ✕ close button:
        // On Exit Modal: x > width - 65, y between 0.55 and 0.65 of height
        // On Bottom Sheets: x > width - 65, y between 0.65 and 0.85 of height
        if (
          locationX > screenWidth - 65 &&
          locationY >= webviewHeight * 0.55 &&
          locationY <= webviewHeight * 0.85
        ) {
          setIsBackdropDimmed(false);
          isExitModalOpenRef.current = false;
          return;
        }

        // 3. Tapping 'Continue to payment' button on Exit Modal (y: 0.81 * h to 0.90 * h)
        if (
          isExitModalOpenRef.current &&
          locationY >= webviewHeight * 0.81 &&
          locationY <= webviewHeight * 0.90
        ) {
          setIsBackdropDimmed(false);
          isExitModalOpenRef.current = false;
          return;
        }

        // 4. Tapping 'Yes, exit' button on Exit Modal (y > 0.90 * h)
        if (
          isExitModalOpenRef.current &&
          locationY > webviewHeight * 0.90
        ) {
          setIsBackdropDimmed(false);
          isExitModalOpenRef.current = false;
          onClose();
          return;
        }
      }
    } catch (_) {}
  };

  // Register Android hardware back button / back swipe listener
  useEffect(() => {
    const onBackPress = () => {
      handleRequestClose();
      return true; // Consume event so app doesn't unexpectedly minimize
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress
    );

    return () => {
      backHandler.remove();
    };
  }, []);

  const { handler, ...optionsWithoutHandler } = options || {};
  const optionsString = JSON.stringify(optionsWithoutHandler);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <style>
          html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            background-color: transparent;
            overflow: hidden;
          }
          iframe {
            display: block;
            width: 100%;
            height: 100%;
            border: none;
          }
        </style>
      </head>
      <body>
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
        <script>
          try {
            var options = ${optionsString};
            window.__isExitModalOpen = false;
            window.__isSheetOpen = false;
            window.__hasMainAppRendered = false;
            window.__isPaymentSuccess = false;

            function notifyPaymentSuccess() {
              if (window.__isPaymentSuccess) return;
              window.__isPaymentSuccess = true;
              notifyDimmed(false);
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'PAYMENT_SUCCESS_SCREEN'
              }));
            }

            function notifyDimmed(isDimmed, isExitModal) {
              if (window.__isPaymentSuccess) {
                isDimmed = false;
              }
              if (isExitModal !== undefined) {
                window.__isExitModalOpen = !!isExitModal;
              }
              if (!isDimmed) {
                window.__isSheetOpen = false;
                window.__isExitModalOpen = false;
              } else if (!isExitModal) {
                window.__isSheetOpen = true;
              }
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'BACKDROP_DIMMED',
                value: !!isDimmed
              }));
            }

            options.handler = function (response) {
              notifyPaymentSuccess();
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'PAYMENT_SUCCESS',
                data: response
              }));
            };

            options.modal = Object.assign({}, options.modal, {
              confirm_close: true,
              handleback: true,
              ondismiss: function () {
                notifyDimmed(false);
                // If a payment failure was recorded, surface it now that the user
                // has closed Razorpay's own failure/retry screen
                if (window.__lastPaymentError) {
                  var err = window.__lastPaymentError;
                  window.__lastPaymentError = null;
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'PAYMENT_FAILED',
                    error: err
                  }));
                } else {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'PAYMENT_CLOSED'
                  }));
                }
              }
            });

            var rzp1 = new Razorpay(options);
            window.__lastPaymentError = null;

            rzp1.on('payment.failed', function (response) {
              try {
                // Store the error but do NOT close the checkout — Razorpay shows its own
                // native failure/retry screen. We surface the error in ondismiss instead.
                var rawErr = (response && response.error) ? response.error : (response || {});
                window.__lastPaymentError = {
                  code: rawErr.code || 'PAYMENT_FAILED',
                  description: rawErr.description || rawErr.message || (typeof rawErr === 'string' ? rawErr : 'Payment could not be completed'),
                  reason: rawErr.reason || 'payment_failed',
                  source: rawErr.source || 'customer',
                  step: rawErr.step || 'payment_authentication',
                  metadata: rawErr.metadata || {}
                };
                // Undim backdrop — Razorpay transitions back to its own failure UI
                notifyDimmed(false);
              } catch (err) {
                window.__lastPaymentError = { description: 'Payment processing failed' };
                notifyDimmed(false);
              }
            });

            rzp1.on('payment.submit', function () {
              try {
                notifyDimmed(true, true);
              } catch (_) {}
            });

            rzp1.on('dismiss', function () {
              try {
                notifyDimmed(false);
              } catch (_) {}
            });

            rzp1.on('render', function () {
              try {
                window.__hasMainAppRendered = true;
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'CHECKOUT_RENDERED'
                }));
                if (!window.__isExitModalOpen && !window.__isSheetOpen && !window.__isPaymentSuccess) {
                  notifyDimmed(false);
                }
                setTimeout(checkBackdropDOM, 50);
              } catch (_) {}
            });

            try {
              rzp1.on('payment.success', function () { notifyPaymentSuccess(); });
              rzp1.on('payment:success', function () { notifyPaymentSuccess(); });
              rzp1.on('checkout_success', function () { notifyPaymentSuccess(); });
              rzp1.on('payment.authorized', function () { notifyPaymentSuccess(); });
              rzp1.on('payment.captured', function () { notifyPaymentSuccess(); });
              rzp1.on('success', function () { notifyPaymentSuccess(); });
            } catch (_) {}

            window.rzp1 = rzp1;

            // Proactive DOM detection for backdrop / shield loader / bottom sheets
            var lastDomBackdropState = true;

            function checkBackdropDOM() {
              try {
                var iframe = document.querySelector('iframe');
                if (!iframe) {
                  if (!window.__hasMainAppRendered) {
                    if (!lastDomBackdropState) {
                      lastDomBackdropState = true;
                      notifyDimmed(true);
                    }
                  }
                  return;
                }

                var doc = null;
                try {
                  doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
                } catch (_) {}

                // Proactively detect payment success screen via DOM
                if (doc) {
                  try {
                    var bodyText = doc.body ? (doc.body.innerText || doc.body.textContent || '') : '';
                    if (
                      bodyText.indexOf('Payment Successful') !== -1 ||
                      bodyText.indexOf('payment successful') !== -1 ||
                      bodyText.indexOf('Payment Success') !== -1 ||
                      bodyText.indexOf('redirected in') !== -1 ||
                      (bodyText.indexOf('Secured by Razorpay') !== -1 && bodyText.indexOf('queries') !== -1)
                    ) {
                      notifyPaymentSuccess();
                      return;
                    }
                    if (doc.querySelector && doc.querySelector('[data-testid*="success"], [class*="success-container"], [class*="payment-success"], .payment-success')) {
                      notifyPaymentSuccess();
                      return;
                    }
                    if (doc.body) {
                      var bg = (iframe.contentWindow && iframe.contentWindow.getComputedStyle)
                        ? iframe.contentWindow.getComputedStyle(doc.body).backgroundColor
                        : doc.body.style.backgroundColor;
                      if (bg && (bg.indexOf('0, 158, 92') !== -1 || bg.indexOf('0, 166, 82') !== -1 || bg.indexOf('4, 155, 92') !== -1 || bg.indexOf('0, 179, 89') !== -1)) {
                        notifyPaymentSuccess();
                        return;
                      }
                    }
                  } catch (_) {}
                }

                var hasBackdrop = false;

                if (doc) {
                  // 1. Check for Razorpay's loader (blue shield screen, magic redirect loader)
                  var loader = doc.getElementById('v2-loader') || doc.querySelector('#secu, .magicx-redirect-loader');
                  if (loader && !loader.classList.contains('off')) {
                    var lStyle = (iframe.contentWindow && iframe.contentWindow.getComputedStyle)
                      ? iframe.contentWindow.getComputedStyle(loader)
                      : (loader.currentStyle || loader.style);
                    if (!lStyle || (lStyle.display !== 'none' && lStyle.visibility !== 'hidden')) {
                      hasBackdrop = true;
                    }
                  }

                  // 2. Check if main app has not rendered yet (while iframe is loading, shield screen is shown)
                  if (!hasBackdrop) {
                    var mainContainer = doc.getElementById('main-container') || doc.querySelector('[data-testid="main-container"], .payment-options');
                    if (!mainContainer && !window.__hasMainAppRendered) {
                      hasBackdrop = true;
                    }
                  }

                  // 3. Check for Exit Confirmation Modal / Dialog
                  if (!hasBackdrop) {
                    var exitModal = doc.querySelector('[data-testid="confirm-close"], .dialog-container, [class*="dialog-container"], [data-testid*="confirm-close"]');
                    if (exitModal) {
                      var emStyle = (iframe.contentWindow && iframe.contentWindow.getComputedStyle)
                        ? iframe.contentWindow.getComputedStyle(exitModal)
                        : (exitModal.currentStyle || exitModal.style);
                      if (!emStyle || (emStyle.display !== 'none' && emStyle.visibility !== 'hidden')) {
                        hasBackdrop = true;
                        window.__isExitModalOpen = true;
                      }
                    }
                  }

                  // 4. Check for Razorpay's internal backdrop element (modal / overlay / bottom-sheet)
                  if (!hasBackdrop) {
                    var backdrop = doc.getElementById('overlay-backdrop') || doc.querySelector('.overlay-backdrop, [class*="overlay-backdrop"]');
                    if (backdrop) {
                      var style = (iframe.contentWindow && iframe.contentWindow.getComputedStyle)
                        ? iframe.contentWindow.getComputedStyle(backdrop)
                        : (backdrop.currentStyle || backdrop.style);
                      if (!style || (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0')) {
                        hasBackdrop = true;
                      }
                    }
                  }

                  // 5. Check for bottom sheet containers or close button
                  if (!hasBackdrop) {
                    var sheetEl = doc.querySelector('[data-testid="account-popover-close"], .stack-overlay, [class*="bottom-sheet"]');
                    if (sheetEl) {
                      hasBackdrop = true;
                    }
                  }
                } else {
                  if (!window.__hasMainAppRendered) {
                    hasBackdrop = true;
                  }
                }

                // 6. Fallback: if exit modal was opened
                if (!hasBackdrop && window.__isExitModalOpen) {
                  if (doc && !doc.querySelector('[data-testid="confirm-close"], .dialog-container, [class*="dialog-container"]')) {
                    window.__isExitModalOpen = false;
                  } else {
                    hasBackdrop = true;
                  }
                }

                if (hasBackdrop !== lastDomBackdropState) {
                  lastDomBackdropState = hasBackdrop;
                  notifyDimmed(hasBackdrop, window.__isExitModalOpen);
                }

                // Attach click and mutation listeners inside iframe if accessible
                if (doc && !doc.__snooListenersAttached) {
                  doc.__snooListenersAttached = true;

                  doc.addEventListener('click', function(ev) {
                    try {
                      var el = ev.target;
                      var testId = el.getAttribute ? el.getAttribute('data-testid') : '';

                      // 1. Back button in header (nav-back) -> opens exit confirmation modal!
                      if (
                        testId === 'nav-back' ||
                        (el.closest && el.closest('[data-testid="nav-back"]'))
                      ) {
                        notifyDimmed(true, true);
                        setTimeout(checkBackdropDOM, 40);
                        setTimeout(checkBackdropDOM, 120);
                        return;
                      }

                      // 2. Account & Terms / More Options
                      if (
                        testId === 'checkout-more-options' ||
                        (el.closest && el.closest('[data-testid="checkout-more-options"]'))
                      ) {
                        notifyDimmed(true, false);
                        setTimeout(checkBackdropDOM, 60);
                        setTimeout(checkBackdropDOM, 150);
                        return;
                      }

                      // 3. Close buttons, modal dismiss, continue to payment (cancel exit)
                      if (
                        testId === 'account-popover-close' ||
                        testId === 'checkout-close' ||
                        el.id === 'overlay-backdrop' ||
                        (el.classList && el.classList.contains('overlay-backdrop')) ||
                        (el.closest && (el.closest('[data-testid="account-popover-close"]') || el.closest('[data-testid="checkout-close"]') || el.closest('[data-testid="confirm-close"] button') || el.closest('.dialog-container button')))
                      ) {
                        setTimeout(checkBackdropDOM, 60);
                        setTimeout(checkBackdropDOM, 200);
                        return;
                      }

                      setTimeout(checkBackdropDOM, 80);
                    } catch (_) {}
                  }, true);

                  try {
                    var observer = new MutationObserver(function() {
                      checkBackdropDOM();
                    });
                    observer.observe(doc.body || doc.documentElement, {
                      childList: true,
                      subtree: true,
                      attributes: true,
                      attributeFilter: ['style', 'class', 'id']
                    });
                  } catch (_) {}
                }
              } catch (_) {}
            }

            setInterval(checkBackdropDOM, 60);

            // Listen to messages from Razorpay iframe to parent window
            window.addEventListener('message', function(event) {
              try {
                var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                if (!data) return;

                var str = JSON.stringify(data).toLowerCase();
                var eventName = (data && data.event) ? String(data.event).toLowerCase() : '';
                var subEvent = (data && data.data && data.data.event) ? String(data.data.event).toLowerCase() : '';

                // Explicit closing indicators
                var isExplicitClosing = (
                  eventName === 'dismiss' ||
                  eventName === 'hidden' ||
                  eventName === 'close' ||
                  subEvent === 'close' ||
                  subEvent === 'dismiss' ||
                  subEvent === 'hidden' ||
                  str.indexOf('modal:close') !== -1 ||
                  str.indexOf('confirm_close:false') !== -1 ||
                  str.indexOf('exit_checkout_no') !== -1 ||
                  str.indexOf('hide_loader') !== -1 ||
                  str.indexOf('dismiss') !== -1 ||
                  str.indexOf('destroy') !== -1 ||
                  str.indexOf('outroend') !== -1 ||
                  str.indexOf('close_click') !== -1 ||
                  str.indexOf('click_close') !== -1 ||
                  str.indexOf('overlay_close') !== -1 ||
                  str.indexOf('sheet_close') !== -1 ||
                  str.indexOf('drawer_close') !== -1 ||
                  str.indexOf('modal_close') !== -1
                );

                // Exit modal specifically
                var isExitModalOpening = (
                  str.indexOf('modal:open') !== -1 ||
                  str.indexOf('confirm_close') !== -1 ||
                  str.indexOf('exit_checkout_page') !== -1
                );

                // Bottom sheets / Drawers / Overlays opening:
                var isSheetOpening = (
                  str.indexOf('accountstripclick') !== -1 ||
                  str.indexOf('account_and_terms') !== -1 ||
                  str.indexOf('account_menu') !== -1 ||
                  str.indexOf('terms_menu') !== -1 ||
                  str.indexOf('terms_and_policies') !== -1 ||
                  str.indexOf('terms_and_conditions') !== -1 ||
                  str.indexOf('terms_of_service') !== -1 ||
                  str.indexOf('privacy_policy') !== -1 ||
                  str.indexOf('curlec_terms') !== -1 ||
                  subEvent.indexOf('account') !== -1 ||
                  subEvent.indexOf('terms') !== -1 ||
                  str.indexOf('price_summary') !== -1 ||
                  str.indexOf('order_summary') !== -1 ||
                  str.indexOf('show_order_summary') !== -1 ||
                  str.indexOf('order_summary_page') !== -1 ||
                  str.indexOf('amount-menu') !== -1 ||
                  str.indexOf('view_details') !== -1 ||
                  str.indexOf('view_full_order_summary') !== -1 ||
                  str.indexOf('price_breakup') !== -1 ||
                  str.indexOf('discount_on_price') !== -1 ||
                  subEvent.indexOf('order_summary') !== -1 ||
                  subEvent.indexOf('price_summary') !== -1 ||
                  (str.indexOf('overlay') !== -1 && str.indexOf('destroy') === -1 && str.indexOf('outroend') === -1) ||
                  str.indexOf('overlay-backdrop') !== -1 ||
                  str.indexOf('bottom_sheet') !== -1 ||
                  str.indexOf('drawer') !== -1 ||
                  str.indexOf('show_loader') !== -1 ||
                  str.indexOf('saving') !== -1 ||
                  str.indexOf('tokenization') !== -1
                );

                // Payment success event detection via postMessage
                if (
                  eventName.indexOf('success') !== -1 ||
                  eventName.indexOf('complete') !== -1 ||
                  subEvent.indexOf('success') !== -1 ||
                  subEvent.indexOf('complete') !== -1 ||
                  str.indexOf('payment.success') !== -1 ||
                  str.indexOf('payment_successful') !== -1 ||
                  str.indexOf('payment_success') !== -1 ||
                  str.indexOf('checkout_success') !== -1 ||
                  str.indexOf('redirected in') !== -1 ||
                  (str.indexOf('payment') !== -1 && str.indexOf('success') !== -1 && str.indexOf('error') === -1 && str.indexOf('fail') === -1)
                ) {
                  notifyPaymentSuccess();
                }

                if (isExplicitClosing) {
                  notifyDimmed(false);
                } else if (isExitModalOpening) {
                  notifyDimmed(true, true);
                } else if (isSheetOpening) {
                  notifyDimmed(true, false);
                }
              } catch (_) {}
            });

            // Unified back handler called by React Native on back swipe
            window.handleAppBack = function() {
              // If checkout hasn't even loaded yet, exit immediately
              if (!window.__hasMainAppRendered) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PAYMENT_CLOSED' }));
                return;
              }

              // 1. If Razorpay exit confirmation dialog is showing, dismiss it
              if (window.__isExitModalOpen) {
                notifyDimmed(false);
                window.history.back();
                try {
                  window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
                } catch (_) {}
                return;
              }

              // 2. If a bottom sheet (Account & Terms, Price summary, etc.) is open, dismiss it
              if (window.__isSheetOpen) {
                notifyDimmed(false);
                try {
                  var iframe = document.querySelector('iframe');
                  if (iframe && iframe.contentDocument) {
                    var closeBtn = iframe.contentDocument.querySelector('[data-testid="account-popover-close"], #overlay-backdrop');
                    if (closeBtn) {
                      closeBtn.click();
                      return;
                    }
                  }
                } catch (_) {}
                window.history.back();
                try {
                  window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
                } catch (_) {}
                return;
              }

              // 3. Pop browser history / trigger popstate for nested screens or exit modal
              window.history.back();
              try {
                window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
              } catch (e) {
                var evt = document.createEvent('Event');
                evt.initEvent('popstate', true, true);
                window.dispatchEvent(evt);
              }
            };

            notifyDimmed(true);
            rzp1.open();
          } catch (initErr) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'PAYMENT_FAILED',
              error: { description: initErr && initErr.message ? initErr.message : 'Failed to initialize payment' }
            }));
          }
        </script>
      </body>
    </html>
  `;

  const handleMessage = (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);

      if (message.type === 'CHECKOUT_RENDERED') {
        setHasRendered(true);
      } else if (message.type === 'PAYMENT_SUCCESS_SCREEN') {
        setIsPaymentSuccess(true);
        setIsBackdropDimmed(false);
      } else if (message.type === 'PAYMENT_SUCCESS') {
        setIsPaymentSuccess(true);
        setIsBackdropDimmed(false);
        onSuccess(message.data);
      } else if (message.type === 'PAYMENT_FAILED') {
        setIsBackdropDimmed(false);
        isExitModalOpenRef.current = false;
        onFailure(message.error || { description: 'Payment could not be completed' });
      } else if (message.type === 'PAYMENT_CLOSED') {
        setIsBackdropDimmed(false);
        isExitModalOpenRef.current = false;
        onClose();
      } else if (message.type === 'BACKDROP_DIMMED') {
        if (!isPaymentSuccess) {
          setIsBackdropDimmed(!!message.value);
          if (!message.value) {
            isExitModalOpenRef.current = false;
          }
        }
      }
    } catch (e) {
      console.warn('[RazorpayCheckout] Failed to parse WebView message:', e);
      onFailure({ description: 'Payment processing encountered an error' });
    }
  };

  const handleNavigation = (request) => {
    const { url } = request;
    if (
      !url.startsWith('http://') &&
      !url.startsWith('https://') &&
      !url.startsWith('about:blank')
    ) {
      Linking.openURL(url).catch((err) => {
        console.warn('[RazorpayCheckout] Could not open external app for URL:', url, err);
      });
      return false;
    }
    return true;
  };

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="slide"
      statusBarTranslucent={true}
      navigationBarTranslucent={true}
      onRequestClose={handleRequestClose}
    >
      <StatusBar
        barStyle={effectiveStatusBarStyle}
        backgroundColor="transparent"
        translucent={true}
        animated={true}
      />
      <KeyboardAvoidingView
        behavior="padding"
        style={[
          styles.rootContainer,
          isPaymentSuccess && { backgroundColor: RAZORPAY_SUCCESS_GREEN },
        ]}
      >
        {/* Top Status Bar Spacer — seamlessly blends with Razorpay header, softly dimming when modals/sheets open, turning Razorpay Green on payment success */}
        <View
          style={[
            styles.statusBarArea,
            {
              height: topInset,
              backgroundColor: isPaymentSuccess ? RAZORPAY_SUCCESS_GREEN : themeColor,
            },
          ]}
        >
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                opacity: isPaymentSuccess ? 0 : backdropAnim,
              },
            ]}
          />
        </View>

        {/* Razorpay WebView Viewport with proactive touch handler */}
        <View
          style={styles.webviewWrapper}
          onTouchStart={handleTouchStart}
        >
          <WebView
            ref={webViewRef}
            originWhitelist={[
              '*',
              'http://*',
              'https://*',
              'upi://*',
              'tez://*',
              'phonepe://*',
              'paytmmp://*',
            ]}
            source={{ html: htmlContent }}
            onMessage={handleMessage}
            onShouldStartLoadWithRequest={handleNavigation}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowFileAccess={true}
            allowFileAccessFromFileURLs={true}
            allowUniversalAccessFromFileURLs={true}
            mixedContentMode="always"
            bounces={false}
            overScrollMode="never"
            style={styles.webview}
            startInLoadingState={false}
          />
        </View>

      </KeyboardAvoidingView>

    </Modal>
  );
};

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  statusBarArea: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  webviewWrapper: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default RazorpayCheckout;
