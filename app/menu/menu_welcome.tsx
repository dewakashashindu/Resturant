import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const LOGO     = require('../../assets/images/CAPTURE 1.png');
const BG_IMAGE = require('../../assets/images/image-removebg-preview.png');

// ══════════════════════════════════════
// BREAKPOINTS & RESPONSIVE VALUES
// ══════════════════════════════════════

const isTablet = SCREEN_WIDTH  >= 600;
const isSmall  = SCREEN_HEIGHT < 700;

// Logo
const logoW  = isTablet ? 280 : isSmall ? 140 : Math.min(174, SCREEN_WIDTH * 0.45);
const logoH  = isTablet ? 106 : isSmall ? 50  : 66;
const logoMT = isTablet ? 80  : isSmall ? 24  : 60;

// Typography
const welcomeFs     = isTablet ? 28  : isSmall ? 15  : 20;
const brandFs       = isTablet ? 48  : isSmall ? 24  : 34;
const descriptionFs = isTablet ? 20  : isSmall ? 10  : 12;
const descLineH     = isTablet ? 28  : isSmall ? 16  : 20;
const btnTextFs     = isTablet ? 22  : isSmall ? 14  : 17;

// Spacing / layout
const headerMT    = isTablet ? 90  : isSmall ? 30  : 70;
const dividerW    = isTablet ? 320 : isSmall ? 160 : 211;
const dividerMT   = isTablet ? 12  : isSmall ? 6   : 8;
const descMT      = isTablet ? 20  : isSmall ? 10  : 16;
const sideMargin  = isTablet ? 32  : isSmall ? 16  : 20;

// Bottom row
const btnHeight   = isTablet ? 72  : isSmall ? 48  : 56;
const btnRadius   = btnHeight / 2;
const circleSize  = isTablet ? 72  : isSmall ? 48  : 56;
const arrowSize   = isTablet ? 46  : isSmall ? 32  : 36;
const bottomPos   = isTablet ? 48  : isSmall ? 16  : 32;
const btnPadL     = isTablet ? 32  : isSmall ? 18  : 24;

// Background image
const bgImgSize   = isTablet ? SCREEN_WIDTH * 1.5 : SCREEN_WIDTH * 1.7;
const bgImgLeft   = isTablet ? -SCREEN_WIDTH * 0.05 : -SCREEN_WIDTH * 0.07;
const bgImgTop    = isTablet ? SCREEN_HEIGHT * 0.45 : SCREEN_HEIGHT * 0.48;

// ══════════════════════════════════════
// HOME ICON
// ══════════════════════════════════════

const HomeIcon = () => {
  const iconScale = isTablet ? 1.4 : isSmall ? 0.85 : 1;
  return (
    <View style={[homeIconStyles.wrapper, {
      width:  24 * iconScale,
      height: 24 * iconScale,
    }]}>
      <View style={[homeIconStyles.chimney, {
        width:  4  * iconScale,
        height: 5  * iconScale,
        top:    2  * iconScale,
        left:   5  * iconScale,
      }]} />
      <View style={[homeIconStyles.roof, {
        borderLeftWidth:   13 * iconScale,
        borderRightWidth:  13 * iconScale,
        borderBottomWidth: 11 * iconScale,
      }]} />
      <View style={[homeIconStyles.wall, {
        width:  18 * iconScale,
        height: 12 * iconScale,
      }]}>
        <View style={[homeIconStyles.door, {
          width:  6 * iconScale,
          height: 7 * iconScale,
        }]} />
      </View>
    </View>
  );
};

const homeIconStyles = StyleSheet.create({
  wrapper: {
    alignItems:     'center',
    justifyContent: 'flex-end',
  },
  chimney: {
    backgroundColor: 'white',
    position:        'absolute',
    zIndex:          1,
  },
  roof: {
    width:             0,
    height:            0,
    borderLeftColor:   'transparent',
    borderRightColor:  'transparent',
    borderBottomColor: 'white',
  },
  wall: {
    backgroundColor: 'white',
    alignItems:      'center',
    justifyContent:  'flex-end',
  },
  door: {
    backgroundColor:      '#2A2A2A',
    borderTopLeftRadius:  3,
    borderTopRightRadius: 3,
  },
});

// ══════════════════════════════════════
// ARROW ICON
// ══════════════════════════════════════

const ArrowIcon = () => {
  const iconScale = isTablet ? 1.4 : isSmall ? 0.85 : 1;
  return (
    <View style={[arrowStyles.wrapper, {
      width:  24 * iconScale,
      height: 24 * iconScale,
    }]}>
      <View style={[arrowStyles.line, {
        width:  16 * iconScale,
        height: 2  * iconScale,
        left:   2  * iconScale,
      }]} />
      <View style={[arrowStyles.headTop, {
        width:  9  * iconScale,
        height: 2  * iconScale,
        right:  2  * iconScale,
        transform: [{ rotate: '40deg' }, { translateY: -3 * iconScale }],
      }]} />
      <View style={[arrowStyles.headBottom, {
        width:  9  * iconScale,
        height: 2  * iconScale,
        right:  2  * iconScale,
        transform: [{ rotate: '-40deg' }, { translateY: 3 * iconScale }],
      }]} />
    </View>
  );
};

const arrowStyles = StyleSheet.create({
  wrapper: {
    justifyContent: 'center',
    alignItems:     'center',
  },
  line: {
    position:        'absolute',
    backgroundColor: 'white',
    borderRadius:    1,
  },
  headTop: {
    position:        'absolute',
    backgroundColor: 'white',
    borderRadius:    1,
  },
  headBottom: {
    position:        'absolute',
    backgroundColor: 'white',
    borderRadius:    1,
  },
});

// ══════════════════════════════════════
// MAIN SCREEN
// ══════════════════════════════════════

const WelcomeScreen = () => {
  const router = useRouter();

  const rotateAnim = useRef(new Animated.Value(0)).current;
  const floatAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue:         1,
        duration:        100000,
        easing:          Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue:         -20,
          duration:        3000,
          easing:          Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue:         0,
          duration:        3000,
          easing:          Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const rotate = rotateAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1B1B1B" />

      {/* ── Animated Background Food Image ── */}
      <Animated.Image
        source={BG_IMAGE}
        style={[
          styles.backgroundImage,
          {
            width:     bgImgSize,
            height:    bgImgSize,
            left:      bgImgLeft,
            top:       bgImgTop,
            transform: [{ rotate }, { translateY: floatAnim }],
          },
        ]}
        resizeMode="cover"
      />

      {/* ── Gradient Overlay ── */}
      <View style={styles.gradientOverlay} />

      {/* ── Logo ── */}
      <Image
        source={LOGO}
        style={{
          width:     logoW,
          height:    logoH,
          alignSelf: 'center',
          marginTop: logoMT,
        }}
        resizeMode="contain"
      />

      {/* ── Welcome Text ── */}
      <Text style={[styles.welcomeText, {
        fontSize:   welcomeFs,
        marginLeft: sideMargin,
        marginTop:  headerMT,
      }]}>
        Welcome to
      </Text>

      {/* ── Brand Name ── */}
      <Text style={[styles.brandName, {
        fontSize:   brandFs,
        marginLeft: sideMargin,
      }]}>
        MICROECHEF.
      </Text>

      {/* ── Divider Line ── */}
      <View style={[styles.divider, {
        width:      dividerW,
        marginLeft: sideMargin,
        marginTop:  dividerMT,
      }]} />

      {/* ── Description ── */}
      <Text style={[styles.description, {
        fontSize:    descriptionFs,
        lineHeight:  descLineH,
        marginLeft:  sideMargin,
        marginRight: sideMargin,
        marginTop:   descMT,
      }]}>
        We are delighted to have you here. {'\n'}
        Enjoy our freshly prepared dishes crafted with love{'\n'}
        and quality ingredients.{'\n'}
        {'\n'}
        Sit back, relax, and enjoy your meal!
      </Text>

      {/* ── Bottom Row: Pill Button + Home Circle ── */}
      <View style={[styles.bottomRow, {
        bottom: bottomPos,
        left:   sideMargin - 4,
        right:  sideMargin - 4,
      }]}>

        <TouchableOpacity
          style={[styles.menuButton, {
            height:       btnHeight,
            borderRadius: btnRadius,
            paddingLeft:  btnPadL,
            paddingRight: isTablet ? 14 : 10,
          }]}
          activeOpacity={0.8}
          onPress={() => router.push('/menu/menu_cato')}
        >
          <Text style={[styles.menuButtonText, { fontSize: btnTextFs }]}>
            Go to Food Menu
          </Text>

          <View style={[styles.arrowCircle, {
            width:        arrowSize,
            height:       arrowSize,
            borderRadius: arrowSize / 2,
          }]}>
            <ArrowIcon />
          </View>
        </TouchableOpacity>

        {/* Home button */}
        <TouchableOpacity
          style={[styles.homeCircle, {
            width:        circleSize,
            height:       circleSize,
            borderRadius: circleSize / 2,
          }]}
          activeOpacity={0.8}
          onPress={() => router.push('/menu/menu_clear' as any)}
        >
          <HomeIcon />
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
};

// ══════════════════════════════════════
// BASE STYLES
// ══════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: '#1B1B1B',
    overflow:        'hidden',
  },

  backgroundImage: {
    position: 'absolute',
  },

  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },

  welcomeText: {
    color:      'rgba(171, 119, 60, 0.9)',
    fontWeight: '400',
  },

  brandName: {
    color:      'white',
    fontWeight: '600',
    marginTop:  4,
  },

  divider: {
    height:          3,
    backgroundColor: 'rgba(171, 119, 60, 0.79)',
    borderRadius:    2,
  },

  description: {
    color:      'white',
    fontWeight: '300',
  },

  bottomRow: {
    position:      'absolute',
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },

  menuButton: {
    flex:            1,
    backgroundColor: 'rgba(171, 119, 60, 0.88)',
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
  },

  menuButtonText: {
    color:      'white',
    fontWeight: '700',
  },

  arrowCircle: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent:  'center',
    alignItems:      'center',
  },

  homeCircle: {
    backgroundColor: '#AB773C',
    justifyContent:  'center',
    alignItems:      'center',
    shadowColor:     '#AB773C',
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.45,
    shadowRadius:    10,
    elevation:       8,
  },
});

export default WelcomeScreen;