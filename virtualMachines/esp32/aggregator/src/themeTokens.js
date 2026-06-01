const TOKEN_ROOT_SELECTOR = '.app-shell';

function getTokenRoot() {
  if (typeof document === 'undefined') return null;
  return document.querySelector(TOKEN_ROOT_SELECTOR) || document.documentElement;
}

function readVar(styles, name, fallback) {
  return String(styles?.getPropertyValue(name) || '').trim() || fallback;
}

function readThemeTokens(themeStyle) {
  const root = getTokenRoot();
  const styles = root ? getComputedStyle(root) : null;
  return {
    activeFill: readVar(styles, '--theme-fsm-active-fill', '#4f7dbd'),
    activeStroke: readVar(styles, '--theme-fsm-active-stroke', '#a8c6f0'),
    activeText: readVar(styles, '--theme-fsm-active-text', '#f4f8ff'),
    doneFill: readVar(styles, '--theme-fsm-done-fill', '#385e8f'),
    doneStroke: readVar(styles, '--theme-fsm-done-stroke', '#7da5dd'),
    doneText: readVar(styles, '--theme-fsm-done-text', '#eff6ff'),
    failedFill: readVar(styles, '--theme-fsm-failed-fill', '#8d4d4d'),
    failedStroke: readVar(styles, '--theme-fsm-failed-stroke', '#d98d8d'),
    failedText: readVar(styles, '--theme-fsm-failed-text', '#fff0f0'),
    background: readVar(styles, '--theme-fsm-background', '#101b2b'),
    border: readVar(styles, '--theme-fsm-border', '#47678f'),
    text: readVar(styles, '--theme-fsm-text', '#dbe9ff'),
    fontFamily: readVar(styles, '--theme-fsm-font-family', 'Georgia, Times New Roman, serif'),
    lineColor: readVar(styles, '--theme-fsm-line-color', '#7aa2d6'),
    secondaryColor: readVar(styles, '--theme-fsm-secondary-color', '#162130'),
    tertiaryColor: readVar(styles, '--theme-fsm-tertiary-color', '#0d1420'),
    mainBkg: readVar(styles, '--theme-fsm-main-bkg', '#18253a'),
    secondBkg: readVar(styles, '--theme-fsm-second-bkg', '#132033'),
    tertiaryBkg: readVar(styles, '--theme-fsm-tertiary-bkg', '#0d1420'),
    nodeBorder: readVar(styles, '--theme-fsm-node-border', '#7aa2d6'),
    strokeWidth: readVar(styles, '--theme-fsm-stroke-width', '1.6px'),
    textColor: readVar(styles, '--theme-fsm-text', '#dbe9ff'),
    theme: String(themeStyle || '').toLowerCase()
  };
}

export function getThemeFsmPalette(themeStyle) {
  return readThemeTokens(themeStyle);
}

export function getThemeMermaidVariables(themeStyle) {
  const palette = readThemeTokens(themeStyle);
  return {
    primaryColor: palette.activeFill,
    primaryTextColor: palette.activeText,
    primaryBorderColor: palette.activeStroke,
    lineColor: palette.lineColor,
    secondaryColor: palette.secondaryColor,
    tertiaryColor: palette.tertiaryColor,
    background: palette.background,
    mainBkg: palette.mainBkg,
    secondBkg: palette.secondBkg,
    tertiaryBkg: palette.tertiaryBkg,
    nodeBorder: palette.nodeBorder,
    fontFamily: palette.fontFamily,
    textColor: palette.textColor
  };
}