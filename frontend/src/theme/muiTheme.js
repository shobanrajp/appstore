import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#ff6b6b', // vibrant coral
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#4ecdc4', // mint
    },
    info: {
      main: '#556ef7',
    },
    background: {
      default: '#fff8f2',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: 'Inter, Roboto, Arial, sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 600 },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 6px 18px rgba(23,23,23,0.06)',
        },
      },
    },
  },
});

export default theme;
