package com.battlecities.game;

import android.os.CancellationSignal;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialException;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

@CapacitorPlugin(name = "GoogleAuth")
public class GoogleAuthPlugin extends Plugin {
    @PluginMethod
    public void signIn(PluginCall call) {
        GetSignInWithGoogleOption googleOption =
            new GetSignInWithGoogleOption.Builder(
                getContext().getString(R.string.google_web_client_id)
            ).build();
        GetCredentialRequest request = new GetCredentialRequest.Builder()
            .addCredentialOption(googleOption)
            .build();

        CredentialManager.create(getContext()).getCredentialAsync(
            getActivity(),
            request,
            new CancellationSignal(),
            ContextCompat.getMainExecutor(getContext()),
            new CredentialManagerCallback(call)
        );
    }

    private static class CredentialManagerCallback implements
        androidx.credentials.CredentialManagerCallback<
            GetCredentialResponse,
            GetCredentialException
        > {
        private final PluginCall call;

        CredentialManagerCallback(PluginCall call) {
            this.call = call;
        }

        @Override
        public void onResult(GetCredentialResponse result) {
            Credential credential = result.getCredential();
            if (!(credential instanceof CustomCredential)) {
                call.reject("Google did not return an ID token");
                return;
            }

            CustomCredential customCredential = (CustomCredential) credential;
            if (!GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(
                customCredential.getType()
            )) {
                call.reject("Unsupported Google credential type");
                return;
            }

            try {
                GoogleIdTokenCredential googleCredential =
                    GoogleIdTokenCredential.createFrom(customCredential.getData());
                JSObject response = new JSObject();
                response.put("idToken", googleCredential.getIdToken());
                call.resolve(response);
            } catch (Exception error) {
                call.reject("Could not read Google ID token", error);
            }
        }

        @Override
        public void onError(@NonNull GetCredentialException error) {
            call.reject("Google sign-in was cancelled or failed", error);
        }
    }
}
