package com.battlecities.game

import android.content.Context
import android.net.Uri
import android.util.Log
import android.util.Base64
import com.funkatronics.encoders.Base58
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.solana.mobilewalletadapter.clientlib.ActivityResultSender
import com.solana.mobilewalletadapter.clientlib.ConnectionIdentity
import com.solana.mobilewalletadapter.clientlib.MobileWalletAdapter
import com.solana.mobilewalletadapter.clientlib.TransactionResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

@CapacitorPlugin(name = "SolanaMobileWallet")
class SolanaMobileWalletPlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private lateinit var walletAdapter: MobileWalletAdapter

    override fun load() {
        super.load()
        walletAdapter = MobileWalletAdapter(
            connectionIdentity = ConnectionIdentity(
                identityUri = Uri.parse("https://play.battlecities.com"),
                iconUri = Uri.parse("data/graphics/favicon.png"),
                identityName = "Battle Cities"
            )
        )
        walletAdapter.authToken = preferences().getString(AUTH_TOKEN_KEY, null)
    }

    @PluginMethod
    fun connect(call: PluginCall) {
        scope.launch {
            Log.i(TAG, "Mobile wallet connect requested")
            try {
                when (val result = walletAdapter.connect(ActivityResultSender(activity))) {
                    is TransactionResult.Success -> {
                        val account = result.authResult.accounts.firstOrNull()
                        if (account == null) {
                            call.reject("The wallet did not provide an account")
                            return@launch
                        }
                        persistAuthToken(result.authResult.authToken)
                        val response = JSObject()
                        response.put("publicKey", Base58.encodeToString(account.publicKey))
                        call.resolve(response)
                    }
                    is TransactionResult.NoWalletFound ->
                        call.reject("No Mobile Wallet Adapter wallet was found. Install Phantom and try again.")
                    is TransactionResult.Failure ->
                        call.reject(result.e.message ?: "Wallet connection failed", result.e)
                }
            } catch (error: Exception) {
                call.reject("Wallet connection failed", error)
            }
        }
    }

    @PluginMethod
    fun signMessage(call: PluginCall) {
        val encodedMessage = call.getString("messageBase64")
        if (encodedMessage.isNullOrBlank()) {
            call.reject("A message is required")
            return
        }

        scope.launch {
            try {
                val message = Base64.decode(encodedMessage, Base64.DEFAULT)
                when (val result = walletAdapter.transact(ActivityResultSender(activity)) { authResult ->
                    signMessagesDetached(
                        arrayOf(message),
                        arrayOf(authResult.accounts.first().publicKey)
                    )
                }) {
                    is TransactionResult.Success -> {
                        persistAuthToken(result.authResult.authToken)
                        val signature = result.payload
                            .messages
                            ?.firstOrNull()
                            ?.signatures
                            ?.firstOrNull()
                        if (signature == null) {
                            call.reject("The wallet did not return a message signature")
                            return@launch
                        }
                        val response = JSObject()
                        response.put(
                            "signatureBase64",
                            Base64.encodeToString(signature, Base64.NO_WRAP)
                        )
                        call.resolve(response)
                    }
                    is TransactionResult.NoWalletFound ->
                        call.reject("No Mobile Wallet Adapter wallet was found. Install Phantom and try again.")
                    is TransactionResult.Failure ->
                        call.reject(result.e.message ?: "Message signing failed", result.e)
                }
            } catch (error: Exception) {
                call.reject("Message signing failed", error)
            }
        }
    }

    @PluginMethod
    fun signTransaction(call: PluginCall) {
        val encodedTransaction = call.getString("transactionBase64")
        if (encodedTransaction.isNullOrBlank()) {
            call.reject("A transaction is required")
            return
        }

        scope.launch {
            try {
                val transaction = Base64.decode(encodedTransaction, Base64.DEFAULT)
                when (val result = walletAdapter.transact(ActivityResultSender(activity)) {
                    signTransactions(arrayOf(transaction))
                }) {
                    is TransactionResult.Success -> {
                        persistAuthToken(result.authResult.authToken)
                        val signedTransaction = result.payload
                            .signedPayloads
                            ?.firstOrNull()
                        if (signedTransaction == null) {
                            call.reject("The wallet did not return a signed transaction")
                            return@launch
                        }
                        val response = JSObject()
                        response.put(
                            "transactionBase64",
                            Base64.encodeToString(signedTransaction, Base64.NO_WRAP)
                        )
                        call.resolve(response)
                    }
                    is TransactionResult.NoWalletFound ->
                        call.reject("No Mobile Wallet Adapter wallet was found. Install Phantom and try again.")
                    is TransactionResult.Failure ->
                        call.reject(result.e.message ?: "Transaction signing failed", result.e)
                }
            } catch (error: Exception) {
                call.reject("Transaction signing failed", error)
            }
        }
    }

    private fun preferences() =
        context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    private fun persistAuthToken(authToken: String?) {
        if (authToken.isNullOrBlank()) {
            return
        }
        walletAdapter.authToken = authToken
        preferences().edit().putString(AUTH_TOKEN_KEY, authToken).apply()
    }

    companion object {
        private const val TAG = "BattleCitiesWallet"
        private const val PREFERENCES_NAME = "solana_mobile_wallet"
        private const val AUTH_TOKEN_KEY = "auth_token"
    }
}
