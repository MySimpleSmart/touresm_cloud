export const isAuthenticated = () => {
  const user = localStorage.getItem('admin_user');
  return !!user;
};

export const requireAuth = () => {
  if (!isAuthenticated()) {
    window.location.href = '/login';
    return false;
  }
  return true;
};

