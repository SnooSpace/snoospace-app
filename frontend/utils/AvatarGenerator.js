
export const AVATAR_GRADIENTS = [
  ['#4facfe', '#00f2fe'], // Blue
  ['#43e97b', '#38f9d7'], // Green
  ['#fa709a', '#fee140'], // Pink/Yellow
  ['#30cfd0', '#330867'], // Teal/Purple
  ['#a18cd1', '#fbc2eb'], // Lavender
  ['#f093fb', '#f5576c'], // Pink/Red
  ['#5ee7df', '#b490ca'], // Cyan/Purple
  ['#c3cfe2', '#c3cfe2'], // Silver (fallback)
];

export const getGradientForName = (name) => {
  if (!name) return AVATAR_GRADIENTS[0];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[index];
};

export const getInitials = (name) => {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};
