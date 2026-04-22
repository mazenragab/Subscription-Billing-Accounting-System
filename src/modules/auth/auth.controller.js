import { 
  register as registerService,
  login as loginService,
  logout as logoutService,
  refreshToken as refreshTokenService,
  getCurrentUser as getCurrentUserService,
  changePassword as changePasswordService,
  forgotPassword as forgotPasswordService,
  resetPassword as resetPasswordService,
} from './auth.service.js';

/**
 * Auth Controller
 * Handles HTTP request/response for authentication
 */

/**
 * Register new user and organization
 */
export async function register(req, res, next) {
  try {
    const { email, password, name, organizationName, organizationSlug } = req.body;
    
    const result = await registerService({
      email,
      password,
      name,
      organizationName,
      organizationSlug,
    });
    
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Login user
 */
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    
    const result = await loginService(email, password);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Logout user
 */
export async function logout(req, res, next) {
  try {
    const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token required',
        code: 'MISSING_REFRESH_TOKEN',
      });
    }
    
    const accessToken = req.headers.authorization?.split(' ')[1];
    
    await logoutService(refreshToken, accessToken);
    
    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Refresh access token
 */
export async function refreshToken(req, res, next) {
  try {
    const { refreshToken } = req.body;
    
    const result = await refreshTokenService(refreshToken);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get current user info
 */
export async function getCurrentUser(req, res, next) {
  try {
    const userId = req.user.userId;
    const organizationId = req.user.organizationId;
    
    const result = await getCurrentUserService(userId, organizationId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Change password
 */
export async function changePassword(req, res, next) {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;
    
    await changePasswordService(userId, currentPassword, newPassword);
    
    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Forgot password - request reset
 */
export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    
    const result = await forgotPasswordService(email);
    
    res.status(200).json({
      success: true,
      message: result.message,
      ...(result.resetToken && { resetToken: result.resetToken }),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Reset password using token
 */
export async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body;
    
    await resetPasswordService(token, newPassword);
    
    res.status(200).json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    next(error);
  }
}

export default {
  register,
  login,
  logout,
  refreshToken,
  getCurrentUser,
  changePassword,
  forgotPassword,
  resetPassword,
};