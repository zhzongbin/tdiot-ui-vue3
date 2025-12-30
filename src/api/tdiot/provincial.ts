import { defHttp } from '/@/utils/http/axios';

enum Api {
  GetToken = '/api/SSOAuth/CheckLoginSSO',
  UploadWarning = '/api/warningMsg/upload',
}

// Hardcoded base URL for the provincial platform
const PROVINCIAL_API_URL = 'http://112.54.44.27:3504';

export const getToken = () => {
  return defHttp.get(
    {
      url: Api.GetToken,
      baseURL: PROVINCIAL_API_URL, 
      params: {
        Operation: 'getTokenId',
        UserAccount: 'adminDKJ',
        Password: '406AE09C2ED940AA7E7F054BD450FC0F',
      },
    },
    {
      isTransformResponse: false, // We need the raw response to get the token string usually, or stick to default if it returns JSON
    },
  );
};

export const uploadWarning = (token: string, data: any) => {
  return defHttp.post(
    {
      url: Api.UploadWarning,
      baseURL: PROVINCIAL_API_URL,
      params: {
        FZXCode: 'DKJ',
      },
      data,
      headers: {
        Authorization: token,
      },
    },
    {
      isTransformResponse: false,
    },
  );
};
