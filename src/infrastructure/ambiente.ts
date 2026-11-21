export type ConfigS3 = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
};

declare const __ATTESTA_CONFIG__: {
  codigoMedico: string;
  clinica: string;
  s3: ConfigS3 | null;
};

export const ambiente = __ATTESTA_CONFIG__;
