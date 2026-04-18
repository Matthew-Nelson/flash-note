export {
  emailSchema,
  loginSchema,
  passwordSchema,
  registerSchema,
  resetPasswordSchema,
  getValidationError,
  validateLogin,
  validateRegister,
} from './auth';

export type {
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from './auth';

export {
  generateNoteSchema,
  noteIdSchema,
  saveNoteSchema,
  updateNoteSectionsSchema,
  updateSectionStyleSchema,
} from './notes';

export type {
  GenerateNoteInput,
  SaveNoteInput,
  UpdateNoteSectionsInput,
  UpdateSectionStyleInput,
} from './notes';

export {
  pronounSchema,
  patientIdSchema,
  createPatientSchema,
  updatePatientSchema,
  updatePatientContextSchema,
  patientSearchSchema,
} from './patients';

export type {
  CreatePatientInput,
  UpdatePatientInput,
  UpdatePatientContextInput,
  PatientSearchInput,
} from './patients';
