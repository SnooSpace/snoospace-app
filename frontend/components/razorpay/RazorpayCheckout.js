import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  Linking,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const RazorpayCheckout = ({
  options,
  onSuccess,
  onFailure,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef(null);
  const [isBackdropDimmed, setIsBackdropDimmed] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

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
  const statusBarStyle = 'light-content';

  // Top inset to ensure Razorpay content sits safely below the physical status bar
  const topInset = Platform.OS === 'android'
    ? Math.max(insets.top || 0, StatusBar.currentHeight || 24)
    : (insets.top || 0);
  const bottomInset = insets.bottom || 0;

  useEffect(() => {
    StatusBar.setBarStyle(statusBarStyle, true);
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor('transparent', true);
      StatusBar.setTranslucent(true);
    }
    return () => {
      StatusBar.setBarStyle('dark-content', true);
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor('transparent', true);
      }
    };
  }, []);

  // Unified back handler: handles back swipe / hardware back press
  // Performs the exact same action that tapping the in-checkout back button would do:
  // 1. If inside a nested payment step -> goes back to Payment Options
  // 2. If at the main screen -> triggers Razorpay's native exit confirmation modal
  // 3. If exit confirmation modal is already showing -> confirms exit and returns to SnooSpace
  const handleRequestClose = () => {
    if (webViewRef.current) {
      // First, attempt native WebView history pop
      webViewRef.current.goBack();
      // Second, trigger JavaScript back navigation & modal handling inside WebView
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
  const optionsString = JSON.stringify(optionsWithoutHandler || {});

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, interactive-widget=resizes-content">
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

            options.handler = function (response) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'PAYMENT_SUCCESS',
                data: response
              }));
            };

            options.modal = Object.assign({}, options.modal, {
              confirm_close: true,
              handleback: true,
              ondismiss: function () {
                window.__isExitModalOpen = false;
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'PAYMENT_CLOSED'
                }));
              }
            });

            var rzp1 = new Razorpay(options);

            rzp1.on('payment.failed', function (response) {
              try {
                var rawErr = (response && response.error) ? response.error : (response || {});
                var errorObj = {
                  code: rawErr.code || 'PAYMENT_FAILED',
                  description: rawErr.description || rawErr.message || (typeof rawErr === 'string' ? rawErr : 'Payment could not be completed'),
                  reason: rawErr.reason || 'payment_failed',
                  source: rawErr.source || 'customer',
                  step: rawErr.step || 'payment_authentication',
                  metadata: rawErr.metadata || {}
                };
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'PAYMENT_FAILED',
                  error: errorObj
                }));
              } catch (err) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'PAYMENT_FAILED',
                  error: { description: 'Payment processing failed' }
                }));
              }
            });

            window.rzp1 = rzp1;

            // Listen to messages from Razorpay iframe to parent window
            window.addEventListener('message', function(event) {
              try {
                var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                if (!data) return;
                var eventName = data.event || data.type || (data.name ? data.name : '');
                if (typeof eventName === 'string') {
                  if (eventName.indexOf('modal:open') !== -1 || eventName.indexOf('confirm_close') !== -1 || eventName.indexOf('exit') !== -1) {
                    window.__isExitModalOpen = true;
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'BACKDROP_DIMMED', value: true }));
                  } else if (eventName.indexOf('modal:close') !== -1 || eventName.indexOf('resume') !== -1) {
                    window.__isExitModalOpen = false;
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'BACKDROP_DIMMED', value: false }));
                  }
                }
              } catch (_) {}
            });

            // Unified back handler called by React Native on back swipe
            window.handleAppBack = function() {
              // If Razorpay exit modal is already visible, back swipe confirms exit
              if (window.__isExitModalOpen) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PAYMENT_CLOSED' }));
                return;
              }

              // Pop browser history / trigger popstate for nested screens
              var prevLen = window.history.length;
              window.history.back();
              try {
                window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
              } catch (e) {
                var evt = document.createEvent('Event');
                evt.initEvent('popstate', true, true);
                window.dispatchEvent(evt);
              }

              // If we are at the root or history pop didn't trigger confirm_close,
              // prompt Razorpay's native exit confirmation dialog
              setTimeout(function() {
                if (!window.__isExitModalOpen && window.rzp1) {
                  window.__isExitModalOpen = true;
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'BACKDROP_DIMMED', value: true }));
                  window.rzp1.close();
                }
              }, 120);
            };

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

      if (message.type === 'PAYMENT_SUCCESS') {
        onSuccess(message.data);
      } else if (message.type === 'PAYMENT_FAILED') {
        onFailure(message.error || { description: 'Payment could not be completed' });
      } else if (message.type === 'PAYMENT_CLOSED') {
        setIsBackdropDimmed(false);
        onClose();
      } else if (message.type === 'BACKDROP_DIMMED') {
        setIsBackdropDimmed(!!message.value);
      }
    } catch (e) {
      console.error('[RazorpayCheckout] Failed to parse WebView message:', e);
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

  const BACKDROP_COLOR = 'rgba(15, 23, 42, 0.72)';

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="slide"
      statusBarTranslucent={true}
      onRequestClose={handleRequestClose}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent={true}
        animated={true}
      />
      <KeyboardAvoidingView
        behavior="padding"
        style={styles.rootContainer}
      >
        {/* Top Status Bar Spacer — styled with uniform dark backdrop instead of white bar */}
        <View
          style={[
            styles.statusBarArea,
            {
              height: topInset,
              backgroundColor: BACKDROP_COLOR,
            },
          ]}
        />

        {/* Razorpay WebView Viewport */}
        <View style={styles.webviewWrapper}>
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
            bounces={false}
            overScrollMode="never"
            style={styles.webview}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.loaderContainer}>
                <ActivityIndicator
                  size="large"
                  color={isLight ? '#2962FF' : themeColor}
                />
              </View>
            )}
          />
        </View>

        {/* Bottom Safe Area Spacer */}
        {!keyboardVisible && bottomInset > 0 && (
          <View
            style={[
              styles.bottomArea,
              {
                height: bottomInset,
                backgroundColor: BACKDROP_COLOR,
              },
            ]}
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
  },
  statusBarArea: {
    width: '100%',
  },
  webviewWrapper: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  bottomArea: {
    width: '100%',
  },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    zIndex: 1001,
  },
});

export default RazorpayCheckout;
